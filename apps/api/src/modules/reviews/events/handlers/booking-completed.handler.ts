// modules/reviews/events/handlers/booking-completed.handler.ts
// Consumes services.booking_completed (delivered by the outbox relay). A completed SERVICE booking is a
// verified transaction between a customer and a provider, so — exactly like a completed order — it
// authorizes a review of the counterparty. Records the eligibility row keyed on the booking id (the
// customer + provider travel IN the event, so no cross-module read — Law 11). Runs INSIDE the relay tx
// and touches only the reviews module's own table. IDEMPOTENT: one eligibility row per booking
// (ON CONFLICT (order_id) DO NOTHING — the booking id occupies the order_id slot, a free uuid).
import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { ReviewRepository } from '../../repositories/review.repository';

@Injectable()
export class BookingCompletedHandler implements OutboxHandler {
  readonly eventType = 'services.booking_completed';
  constructor(private readonly repo: ReviewRepository) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    const bookingId = (typeof p.bookingId === 'string' && p.bookingId) ? p.bookingId : event.aggregateId;
    const customerUserId = p.customerUserId as string | undefined;     // the buyer side (reviews the provider)
    const providerUserId = p.providerUserId as string | undefined;     // the seller side (reviews the customer)
    if (!tenantId || !bookingId || !customerUserId || !providerUserId) return;   // malformed → ignore
    if (customerUserId === providerUserId) return;                     // defensive: no self-review
    await this.repo.insertEligibility(tx, tenantId, bookingId, customerUserId, providerUserId);
  }
}
