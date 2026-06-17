// modules/payments/events/handlers/trade-invoice.handler.ts
// Consumes orders.order_completed (via the outbox relay) and generates the buyer's GST trade
// invoice for the order. Runs inside the relay tx; idempotent (one invoice per order). Separate
// from the settlement handler (single responsibility) — the dispatcher fans the event to both.
import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { TradeInvoiceService } from '../../services/trade-invoice.service';

@Injectable()
export class TradeInvoiceHandler implements OutboxHandler {
  readonly eventType = 'orders.order_completed';
  constructor(private readonly invoices: TradeInvoiceService) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const totalRaw = event.payload.totalMinor as string | undefined;
    if (!tenantId || !totalRaw) return;
    const total = BigInt(totalRaw);
    if (total <= 0n) return;

    await this.invoices.generateForOrder(tx, {
      tenantId, orderId: event.aggregateId,
      buyerUserId: (event.payload.buyerUserId as string) ?? null,
      sellerUserId: (event.payload.sellerUserId as string) ?? null,
      totalMinor: total,
      categoryId: (event.payload.categoryId as string) ?? null,
      countryCode: (event.payload.countryCode as string) ?? 'IN',
    });
  }
}
