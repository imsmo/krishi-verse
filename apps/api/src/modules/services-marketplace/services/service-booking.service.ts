// modules/services-marketplace/services/service-booking.service.ts · THE BOOKING MONEY PATH.
// A customer requests a booking (fee = offering price × guests, snapshotted); the provider accepts → starts;
// the customer confirms completion + PAYS — customer userMain → provider userMain via the wallet boundary
// (txnType 'service_fee', a ZERO-SUM, idempotent ledger txn — Law 2). Every write: one ACID tx (UoW), state
// via the machine (Law 5), outbox in-tx (Law 4), idempotent money mutations (Law 3), authz THROWS (Law 6).
// No version column → bookings lock FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ServiceBooking } from '../domain/service-booking.entity';
import { DomainEvent, ServicesEventType } from '../domain/services-marketplace.events';
import { ServiceBookingRepository } from '../repositories/service-booking.repository';
import { ServiceOfferingRepository } from '../repositories/service-offering.repository';
import { RequestBookingDto } from '../dto/create-service-booking.dto';
import { OfferingNotFoundError, OfferingNotBookableError, BookingNotFoundError, InvalidBookingError, ServicesForbiddenError } from '../domain/services-marketplace.errors';
import { ServicesActor } from './service-offering.service';

const bookingNo = (id: string) => `SB-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 8).toUpperCase()}`;

@Injectable()
export class ServiceBookingService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly bookings: ServiceBookingRepository,
    private readonly offerings: ServiceOfferingRepository,
  ) {}

  async request(tenantId: string, actor: ServicesActor, idemKey: string, dto: RequestBookingDto) {
    if (!actor.canBook) throw new ServicesForbiddenError('requires service.book');
    return this.idem.remember(idemKey, actor.userId, 'services.booking.request', () =>
      timed(this.metrics, 'services.booking.request', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const offering = await this.offerings.getById(tenantId, dto.offeringId, tx);
          if (!offering) throw new OfferingNotFoundError(dto.offeringId);
          if (offering.status !== 'published') throw new OfferingNotBookableError(offering.status);
          if (offering.providerUserId === actor.userId) throw new InvalidBookingError('cannot book your own offering');
          const id = uuidv7();
          const booking = ServiceBooking.request({ id, tenantId, offeringId: offering.id, providerUserId: offering.providerUserId, customerUserId: actor.userId, bookingNo: bookingNo(id),
            startsAt: new Date(dto.startsAt), endsAt: dto.endsAt ? new Date(dto.endsAt) : null, guests: dto.guests, totalMinor: offering.totalFor(dto.guests), notes: dto.notes ?? null });
          await this.bookings.insert(tx, booking);
          await this.flush(tx, tenantId, booking.id, booking.pullEvents());
          return booking.toJSON();
        }, { userId: actor.userId })));
  }

  async accept(tenantId: string, actor: ServicesActor, id: string) { return this.providerMutate(tenantId, actor, id, (b) => b.confirm()); }
  async start(tenantId: string, actor: ServicesActor, id: string) { return this.providerMutate(tenantId, actor, id, (b) => b.start()); }
  async cancel(tenantId: string, actor: ServicesActor, id: string, reason?: string) {
    return this.uow.run(tenantId, async (tx) => {
      const booking = await this.bookings.getForUpdate(tx, tenantId, id);
      if (!booking) throw new BookingNotFoundError(id);
      if (booking.customerUserId !== actor.userId && booking.providerUserId !== actor.userId && !actor.isAdmin) throw new ServicesForbiddenError('not a party to this booking');
      booking.cancel(reason);
      await this.bookings.update(tx, booking);
      await this.flush(tx, tenantId, booking.id, booking.pullEvents());
      return booking.toJSON();
    }, { userId: actor.userId });
  }

  /** Customer confirms completion + settles the fee (customer → provider, zero-sum, idempotent). */
  async completeAndPay(tenantId: string, actor: ServicesActor, id: string, idemKey: string) {
    if (!actor.canBook) throw new ServicesForbiddenError('requires service.book');
    return this.idem.remember(idemKey, actor.userId, 'services.booking.pay', () =>
      timed(this.metrics, 'services.booking.pay', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const booking = await this.bookings.getForUpdate(tx, tenantId, id);
          if (!booking) throw new BookingNotFoundError(id);
          if (booking.customerUserId !== actor.userId && !actor.isAdmin) throw new ServicesForbiddenError('only the customer may complete + pay');
          booking.complete();   // throws if not in_progress
          await this.wallet.post(tx, { tenantId, txnType: 'service_fee', idempotencyKey: `svcbook:${booking.id}`, referenceType: 'service_booking', referenceId: booking.id, initiatedBy: actor.userId,
            legs: [{ account: userMain(booking.customerUserId), amountMinor: -booking.totalMinor }, { account: userMain(booking.providerUserId), amountMinor: booking.totalMinor }] });
          await this.bookings.update(tx, booking);
          for (const e of booking.pullEvents()) await this.outbox.write(tx, { tenantId, aggregateType: 'service_booking', aggregateId: booking.id, eventType: e.type, payload: { v: 1, ...e.payload } });
          await this.outbox.write(tx, { tenantId, aggregateType: 'service_booking', aggregateId: booking.id, eventType: ServicesEventType.BookingFeePaid, payload: { v: 1, bookingId: booking.id, providerUserId: booking.providerUserId, totalMinor: booking.totalMinor.toString() } });
          return { ...booking.toJSON(), feePaidMinor: booking.totalMinor.toString() };
        }, { userId: actor.userId })));
  }

  async getById(tenantId: string, actor: ServicesActor, id: string) {
    const b = await this.bookings.getById(tenantId, id);
    if (!b) throw new BookingNotFoundError(id);
    if (b.customerUserId !== actor.userId && b.providerUserId !== actor.userId && !actor.isAdmin) throw new BookingNotFoundError(id); // 404, no IDOR
    return b.toJSON();
  }
  async list(tenantId: string, actor: ServicesActor, q: { box: 'customer' | 'provider' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.isAdmin) throw new ServicesForbiddenError('requires booking.manage');
    const rows = await this.bookings.listFor(tenantId, { customerUserId: q.box === 'customer' ? actor.userId : undefined, providerUserId: q.box === 'provider' ? actor.userId : undefined, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((b) => b.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async providerMutate(tenantId: string, actor: ServicesActor, id: string, fn: (b: ServiceBooking) => void) {
    if (!actor.canOffer) throw new ServicesForbiddenError('requires service.offer');
    return this.uow.run(tenantId, async (tx) => {
      const booking = await this.bookings.getForUpdate(tx, tenantId, id);
      if (!booking) throw new BookingNotFoundError(id);
      if (booking.providerUserId !== actor.userId && !actor.isAdmin) throw new ServicesForbiddenError('only the provider may act here');
      fn(booking);
      await this.bookings.update(tx, booking);
      await this.flush(tx, tenantId, booking.id, booking.pullEvents());
      return booking.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'service_booking', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
