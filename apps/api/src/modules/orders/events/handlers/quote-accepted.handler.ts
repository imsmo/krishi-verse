// modules/orders/events/handlers/quote-accepted.handler.ts
// Consumes requirements.quote_accepted (delivered by the outbox relay). A buyer accepted a seller's
// quote on a requirement → create the order at the quoted per-unit price × quantity, source='requirement',
// requirement_id set (the provenance link — requirements has no order_id column, so this IS the link).
// Runs INSIDE the relay tx. Cross-module rule: product/title/seller come from ListingService (Law 11);
// we touch only the orders module's own repository. IDEMPOTENT: if an order already exists for this
// requirement, no-op — so at-least-once re-delivery never double-creates.
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_WRITER, OutboxWriter } from '../../../../core/outbox/outbox.writer';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { FlagsService } from '../../../../core/feature-flags/flags.service';
import { uuidv7 } from '../../../../core/database/uuid.util';
import { Metrics, METRICS } from '../../../../core/observability/metrics';
import { ListingService } from '../../../listings/services/listing.service';
import { OrderRepository } from '../../repositories/order.repository';
import { Order } from '../../domain/order.entity';
import { OrderItem } from '../../domain/order-item.entity';
import { DomainEvent } from '../../domain/orders.events';

function orderNo(id: string): string { return `KV${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`; }

@Injectable()
export class QuoteAcceptedHandler implements OutboxHandler {
  readonly eventType = 'requirements.quote_accepted';
  constructor(
    private readonly repo: OrderRepository,
    private readonly listings: ListingService,
    private readonly flags: FlagsService,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    const requirementId = p.requirementId as string | undefined;
    const buyerUserId = p.buyerUserId as string | undefined;
    const listingId = p.listingId as string | undefined;
    const quotedPriceMinor = p.quotedPriceMinor as string | undefined;
    const quantity = p.quantity as string | undefined;
    if (!tenantId || !requirementId || !buyerUserId || !listingId || !quotedPriceMinor || !quantity) return;  // malformed

    if (await this.repo.existsForRequirement(tx, tenantId, requirementId)) return;     // idempotent (re-delivery)

    const l: any = await this.listings.getById(tenantId, listingId);                   // Law 11: seller/product via the service
    if (!l) return;                                                                    // listing vanished — cannot snapshot
    const sellerUserId = l.sellerUserId as string;
    if (sellerUserId === buyerUserId) return;                                          // defensive: requirements forbids self-quote

    const requiresPayment = await this.flags.isEnabled('online_payments', { tenantId, userId: buyerUserId });
    const now = new Date();
    const orderId = uuidv7();
    const item = OrderItem.of({
      id: uuidv7(), orderId, orderCreatedAt: now, tenantId, listingId, productId: l.productId,
      titleSnapshot: l.title, quantity: Number(quantity), unitCode: l.unitCode,
      unitPriceMinor: BigInt(quotedPriceMinor), gstRatePct: null, hsnCode: null, batchId: null,
    });
    const order = Order.place({
      id: orderId, tenantId, orderNo: orderNo(orderId), checkoutGroupId: null, buyerUserId,
      sellerUserId, source: 'requirement', requirementId, currencyCode: l.currencyCode ?? 'INR', items: [item],
      deliveryMethodId: null, deliveryAddressId: null, requiresPayment, now,
    });
    await this.repo.insertGraph(tx, order, [item]);
    await this.flush(tx, tenantId, orderId, order.pullEvents());                       // order_created (+ payment_required)
    this.metrics.inc('orders.from_requirement', { tenant: tenantId });
  }

  private async flush(tx: TxContext, tenantId: string, orderId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: orderId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
