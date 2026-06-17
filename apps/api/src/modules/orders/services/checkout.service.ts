// modules/orders/services/checkout.service.ts
// Converts the buyer's active cart into ONE order per seller (+ a checkout group when
// multi-seller). All in ONE ACID tx with outbox events (Law 4); idempotent (Law 3); quota
// enforced. The MONEY step is owned by the payments module: if the `online_payments` flag is
// on, orders start at payment_pending and emit orders.payment_required; otherwise COD-style
// 'created' awaiting seller confirm. Item prices/titles are SNAPSHOT into the order.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { FlagsService } from '../../../core/feature-flags/flags.service';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ListingService } from '../../listings/services/listing.service';
import { ChargePricingService } from '../../payments/services/charge-pricing.service';
import { CartRepository } from '../repositories/cart.repository';
import { OrderRepository } from '../repositories/order.repository';
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { DomainEvent } from '../domain/orders.events';
import { CartEmptyError, CartNotFoundError, ListingNotPurchasableError, InsufficientListingStockError } from '../domain/orders.errors';
import { CheckoutDto } from '../dto/create-order.dto';

const QUOTA = 'max_orders_month';
function orderNo(id: string): string { return `KV${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`; }

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly flags: FlagsService,
    private readonly listings: ListingService,
    private readonly carts: CartRepository,
    private readonly orders: OrderRepository,
    private readonly charges: ChargePricingService,
  ) {}

  async checkout(tenantId: string, buyerUserId: string, idemKey: string, dto: CheckoutDto) {
    return this.idem.remember(idemKey, buyerUserId, 'orders.checkout', () =>
      timed(this.metrics, 'orders.checkout', { tenant: tenantId }, async () => {
        const requiresPayment = await this.flags.isEnabled('online_payments', { tenantId, userId: buyerUserId });
        const applyCharges = await this.flags.isEnabled('buyer_charges', { tenantId, userId: buyerUserId });

        return this.uow.run(tenantId, async (tx) => {
          const cartId = await this.carts.activeIdForUpdate(tx, tenantId, buyerUserId);
          if (!cartId) throw new CartNotFoundError();
          const cartItems = await this.carts.itemsForUpdate(tx, cartId);
          if (cartItems.length === 0) throw new CartEmptyError();

          // resolve listings + group order items by seller
          const bySeller = new Map<string, { items: OrderItem[]; createdAt: Date; orderId: string }>();
          for (const ci of cartItems) {
            const l: any = await this.listings.getById(tenantId, ci.listing_id);
            if (!l || l.status !== 'published') throw new ListingNotPurchasableError(ci.listing_id);
            const qty = Number(ci.quantity);
            if (Number(l.quantityAvailable) < qty) throw new InsufficientListingStockError(ci.listing_id, qty, Number(l.quantityAvailable));
            let g = bySeller.get(l.sellerUserId);
            if (!g) { const orderId = uuidv7(); g = { items: [], createdAt: new Date(), orderId }; bySeller.set(l.sellerUserId, g); }
            g.items.push(OrderItem.of({ id: uuidv7(), orderId: g.orderId, orderCreatedAt: g.createdAt, tenantId, listingId: ci.listing_id,
              productId: l.productId, titleSnapshot: l.title, quantity: qty, unitCode: l.unitCode, unitPriceMinor: BigInt(l.priceMinor),
              gstRatePct: null, hsnCode: null, batchId: null }));
          }

          const checkoutGroupId = bySeller.size > 1 ? uuidv7() : null;
          if (checkoutGroupId) {
            const total = [...bySeller.values()].reduce((s, g) => s + g.items.reduce((a, it) => a + it.props.lineTotalMinor, 0n), 0n);
            await tx.query(`INSERT INTO checkout_groups (id, tenant_id, buyer_user_id, total_minor, currency_code) VALUES ($1,$2,$3,$4,'INR')`,
              [checkoutGroupId, tenantId, buyerUserId, total.toString()]);
          }

          const created: Array<{ id: string; orderNo: string; totalMinor: string; status: string }> = [];
          for (const [sellerUserId, g] of bySeller) {
            await this.quota.assertWithinLimit(tenantId, QUOTA);
            // buyer-side charges (delivery slab + platform fee) on this seller's subtotal — flagged
            const subtotal = g.items.reduce((a, it) => a + it.props.lineTotalMinor, 0n);
            const { deliveryFeeMinor, platformFeeMinor } = applyCharges
              ? await this.charges.checkoutCharges(tx, tenantId, subtotal)
              : { deliveryFeeMinor: 0n, platformFeeMinor: 0n };
            const order = Order.place({ id: g.orderId, tenantId, orderNo: orderNo(g.orderId), checkoutGroupId, buyerUserId,
              sellerUserId, source: 'direct', currencyCode: 'INR', items: g.items, deliveryFeeMinor, platformFeeMinor,
              deliveryMethodId: dto.deliveryMethodId ?? null, deliveryAddressId: dto.deliveryAddressId ?? null, requiresPayment, now: g.createdAt });
            await this.orders.insertGraph(tx, order, g.items);
            await this.quota.increment(tx, tenantId, QUOTA, 1);
            await this.flush(tx, tenantId, g.orderId, order.pullEvents());
            const p = order.toProps();
            created.push({ id: p.id, orderNo: p.orderNo, totalMinor: p.totalMinor.toString(), status: p.status });
          }
          await this.carts.markConverted(tx, cartId);
          this.metrics.inc('orders.checkout_done', { tenant: tenantId, orders: String(created.length) });
          return { orders: created, checkoutGroupId };
        }, { userId: buyerUserId });
      }));
  }

  private async flush(tx: TxContext, tenantId: string, orderId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: orderId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
