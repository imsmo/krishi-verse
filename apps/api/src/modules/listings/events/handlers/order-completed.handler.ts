// modules/listings/events/handlers/order-completed.handler.ts
// Reacts to orders.order_completed: decrement listing stock. Consumed from the
// stream; idempotency is enforced by the consumer framework (dedupe on event id),
// and reduceStock itself is guarded by the aggregate invariant (no oversell).
import { Injectable, Logger } from '@nestjs/common';
import { ListingService } from '../../services/listing.service';
import { InsufficientStockError } from '../../domain/listing.errors';

interface OrderCompletedV1 { v: 1; tenantId: string; listingId: string; quantity: number; orderId: string; }

@Injectable()
export class OrderCompletedHandler {
  private readonly log = new Logger(OrderCompletedHandler.name);
  constructor(private readonly listings: ListingService) {}

  async handle(evt: OrderCompletedV1): Promise<void> {
    try {
      await this.listings.reduceStock(evt.tenantId, evt.listingId, evt.quantity);
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        // Order layer reserves stock at checkout, so this should not happen; if it
        // does it's a reconciliation signal, not a crash. Log + let the consumer ack
        // (a compensating event would be raised by the order saga).
        this.log.error(`stock underflow on listing ${evt.listingId} for order ${evt.orderId}: ${e.message}`);
        return;
      }
      throw e; // transient → let the consumer retry
    }
  }
}
