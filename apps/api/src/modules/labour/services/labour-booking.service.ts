// modules/labour/services/labour-booking.service.ts
// The labour spine: an employer POSTS a booking (with THE DIGNITY FLOOR snapshotted from minimum_wages),
// assigns workers, workers CONSENT, the employer starts + completes the engagement, and WAGES ARE SETTLED
// through the wallet boundary (Law 2) — employer userMain → worker userMain, txnType 'wage_payout', a
// ZERO-SUM, idempotent ledger txn (the wallet's no-overdraw rule means the employer must hold the money).
// Every write: one ACID tx (UoW), state via the machine (Law 5), outbox in-tx (Law 4), idempotent
// mutations (Law 3), quota on create, authz that THROWS (Law 6). Booking concurrency = optimistic version.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { LabourBooking } from '../domain/labour-booking.entity';
import { BookingAssignment } from '../domain/booking-assignment.entity';
import { DomainEvent, SkillLevel, WageKind } from '../domain/labour.events';
import { LabourBookingRepository } from '../repositories/labour-booking.repository';
import { BookingAssignmentRepository } from '../repositories/booking-assignment.repository';
import { WorkerProfileRepository } from '../repositories/worker-profile.repository';
import { MinimumWageService } from './minimum-wage.service';
import { CreateBookingDto } from '../dto/create-labour-booking.dto';
import {
  BookingNotFoundError, AssignmentNotFoundError, WorkerProfileNotFoundError, LabourForbiddenError,
  WageBelowMinimumError, BookingFullError, WorkerAlreadyAssignedError, BookingNotPayableError,
} from '../domain/labour.errors';

const QUOTA_METRIC = 'labour_bookings';
export interface LabourActor { userId: string; canBook: boolean; canManage: boolean; }
const bookingNo = (id: string) => `LB-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 8).toUpperCase()}`;

@Injectable()
export class LabourBookingService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly audit: AuditWriter,
    private readonly bookings: LabourBookingRepository,
    private readonly assignments: BookingAssignmentRepository,
    private readonly workers: WorkerProfileRepository,
    private readonly minWage: MinimumWageService,
  ) {}

  // ---- employer: post a booking (dignity floor enforced) ----
  async create(tenantId: string, actor: LabourActor, idemKey: string, dto: CreateBookingDto) {
    if (!actor.canBook) throw new LabourForbiddenError('requires worker.book');
    return this.idem.remember(idemKey, actor.userId, 'labour.booking.create', () =>
      timed(this.metrics, 'labour.booking.create', { tenant: tenantId }, async () => {
        await this.quota.assertWithinLimit(tenantId, QUOTA_METRIC);
        const offered = BigInt(dto.wageOfferedMinor);
        return this.uow.run(tenantId, async (tx) => {
          const demandTypeId = await this.bookings.resolveDemandTypeId(tx, dto.demandTypeCode);
          await this.bookings.assertSkillExists(tx, dto.taskSkillId);
          // Snapshot the statutory floor for the region/skill-level on the start date (fail-closed if none).
          const floor = await this.minWage.resolveFloor(tenantId, dto.regionId, dto.skillLevel as SkillLevel, dto.wageKind as WageKind, dto.startDate, tx);
          if (offered < floor) throw new WageBelowMinimumError(offered, floor);
          const id = uuidv7();
          const respondBy = dto.respondByHours ? new Date(Date.now() + dto.respondByHours * 3600_000) : null;
          const booking = LabourBooking.post({
            id, tenantId, bookingNo: bookingNo(id), employerUserId: actor.userId, demandTypeId, taskSkillId: dto.taskSkillId,
            workersNeeded: dto.workersNeeded, startDate: dto.startDate, endDate: dto.endDate, dailyHours: dto.dailyHours,
            wageKind: dto.wageKind as WageKind, wageOfferedMinor: offered, minWageMinor: floor, currencyCode: 'INR',
            overtimeRateMultiplier: 1.5, womenOnly: dto.womenOnly, farmLat: dto.farmLat, farmLng: dto.farmLng, respondBy,
          });
          await this.bookings.insert(tx, booking);
          await this.quota.increment(tx, tenantId, QUOTA_METRIC, 1);
          await this.flush(tx, tenantId, 'labour_booking', booking.id, booking.pullEvents());
          return this.serializeBooking(booking);
        }, { userId: actor.userId });
      }));
  }

  // ---- employer: assign a worker to an open booking ----
  async assign(tenantId: string, actor: LabourActor, bookingId: string, idemKey: string, dto: { workerId: string; wageMinor?: string }) {
    if (!actor.canBook) throw new LabourForbiddenError('requires worker.book');
    return this.idem.remember(idemKey, actor.userId, 'labour.booking.assign', () =>
      this.uow.run(tenantId, async (tx) => {
        const booking = await this.bookings.getForWrite(tx, tenantId, bookingId);
        if (!booking) throw new BookingNotFoundError(bookingId);
        this.assertOwnerOrManager(booking, actor);
        if (booking.status !== 'open') throw new BookingNotPayableError(booking.status);
        if (await this.assignments.countActive(tx, tenantId, bookingId) >= booking.workersNeeded) throw new BookingFullError(booking.workersNeeded);
        if (await this.assignments.findByBookingAndWorker(tx, tenantId, bookingId, dto.workerId)) throw new WorkerAlreadyAssignedError();
        const worker = await this.workers.getById(tenantId, dto.workerId, tx);
        if (!worker) throw new WorkerProfileNotFoundError(dto.workerId);
        worker.assertAssignable();                                  // HARD age-18 gate (Law: refuse)
        const wage = dto.wageMinor ? BigInt(dto.wageMinor) : booking.wageOfferedMinor;
        if (wage < booking.toProps().minWageMinor) throw new WageBelowMinimumError(wage, booking.toProps().minWageMinor);
        const assignment = BookingAssignment.create({ id: uuidv7(), bookingId, tenantId, workerId: dto.workerId, wageMinor: wage });
        await this.assignments.insert(tx, assignment);
        await this.flush(tx, tenantId, 'booking_assignment', assignment.id, assignment.pullEvents());
        return this.serializeAssignment(assignment);
      }, { userId: actor.userId }));
  }

  // ---- worker: SELF-APPLY to an open booking (creates an 'applied' assignment, an interest pool) ----
  async applyAsWorker(tenantId: string, userId: string, bookingId: string, idemKey: string) {
    return this.idem.remember(idemKey, userId, 'labour.booking.apply', () =>
      timed(this.metrics, 'labour.booking.apply', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const booking = await this.bookings.getForWrite(tx, tenantId, bookingId);
          if (!booking) throw new BookingNotFoundError(bookingId);
          if (booking.status !== 'open') throw new BookingNotPayableError(booking.status);    // only open bookings accept applications
          const worker = await this.workers.findByUser(tenantId, userId, tx);                 // the caller's OWN worker profile
          if (!worker) throw new WorkerProfileNotFoundError(userId);
          worker.assertAssignable();                                                          // HARD age-18 gate (Law: refuse)
          if (await this.assignments.findByBookingAndWorker(tx, tenantId, bookingId, worker.id)) throw new WorkerAlreadyAssignedError();
          const assignment = BookingAssignment.apply({ id: uuidv7(), bookingId, tenantId, workerId: worker.id, wageMinor: booking.wageOfferedMinor });
          await this.assignments.insert(tx, assignment);
          await this.flush(tx, tenantId, 'booking_assignment', assignment.id, assignment.pullEvents());
          return this.serializeAssignment(assignment);
        }, { userId }));
      });
  }

  // ---- worker: consent (accept) or decline (reject) their own assignment ----
  async respond(tenantId: string, userId: string, assignmentId: string, dto: { decision: 'accept' | 'reject'; voiceConsentMediaId?: string }) {
    return this.uow.run(tenantId, async (tx) => {
      const assignment = await this.assignments.getForUpdate(tx, tenantId, assignmentId);
      if (!assignment) throw new AssignmentNotFoundError(assignmentId);
      const mine = await this.workers.findByUser(tenantId, userId, tx);
      if (!mine || mine.id !== assignment.workerId) throw new LabourForbiddenError('only the assigned worker may respond');
      if (dto.decision === 'accept') assignment.accept(new Date(), dto.voiceConsentMediaId ?? null);
      else assignment.reject();
      await this.assignments.update(tx, assignment);
      await this.flush(tx, tenantId, 'booking_assignment', assignment.id, assignment.pullEvents());
      return this.serializeAssignment(assignment);
    }, { userId });
  }

  // ---- employer: start the engagement (needs ≥1 accepted worker) ----
  async start(tenantId: string, actor: LabourActor, bookingId: string) {
    return this.transitionBooking(tenantId, actor, bookingId, async (booking, tx) => {
      const accepted = await this.assignments.listAcceptedForUpdate(tx, tenantId, bookingId);
      if (accepted.length === 0) throw new BookingNotPayableError('no accepted workers');
      booking.start();
    });
  }

  // ---- employer: confirm work done ----
  async complete(tenantId: string, actor: LabourActor, bookingId: string) {
    return this.transitionBooking(tenantId, actor, bookingId, async (booking) => { booking.complete(); });
  }

  // ---- employer: cancel (open or in_progress) ----
  async cancel(tenantId: string, actor: LabourActor, bookingId: string, reason?: string) {
    return this.transitionBooking(tenantId, actor, bookingId, async (booking) => { booking.cancel(reason); });
  }

  // ---- employer: SETTLE WAGES (the money path) — completed → paid ----
  async payWages(tenantId: string, actor: LabourActor, bookingId: string, idemKey: string) {
    if (!actor.canBook) throw new LabourForbiddenError('requires worker.book');
    return this.idem.remember(idemKey, actor.userId, 'labour.booking.pay', () =>
      timed(this.metrics, 'labour.booking.pay', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const booking = await this.bookings.getForWrite(tx, tenantId, bookingId);
          if (!booking) throw new BookingNotFoundError(bookingId);
          this.assertOwnerOrManager(booking, actor);
          if (booking.status !== 'completed') throw new BookingNotPayableError(booking.status);
          const version = booking.version;
          const accepted = await this.assignments.listAcceptedForUpdate(tx, tenantId, bookingId);
          if (accepted.length === 0) throw new BookingNotPayableError('no accepted workers to pay');
          let total = 0n;
          for (const a of accepted) {
            const worker = await this.workers.getById(tenantId, a.workerId, tx);
            if (!worker) throw new WorkerProfileNotFoundError(a.workerId);
            // Employer pays the worker their agreed wage — a balanced, idempotent wallet transfer (Law 2).
            await this.wallet.post(tx, {
              tenantId, txnType: 'wage_payout', idempotencyKey: `wage:${a.id}`, referenceType: 'labour_booking', referenceId: bookingId, initiatedBy: actor.userId,
              legs: [{ account: userMain(booking.employerUserId), amountMinor: -a.wageMinor }, { account: userMain(worker.userId), amountMinor: a.wageMinor }],
            });
            a.markPaid();
            await this.assignments.update(tx, a);
            await this.flush(tx, tenantId, 'booking_assignment', a.id, a.pullEvents());
            total += a.wageMinor;
          }
          booking.markPaid(total, accepted.length);
          await this.bookings.update(tx, booking, version);
          await this.flush(tx, tenantId, 'labour_booking', booking.id, booking.pullEvents());
          return { ...this.serializeBooking(booking), totalPaidMinor: total.toString(), workersPaid: accepted.length };
        }, { userId: actor.userId })));
  }

  /** Worker job: expire an OPEN booking past respond_by + lapse its pending assignments. Idempotent. */
  async expireBooking(tenantId: string, bookingId: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const booking = await this.bookings.getForWrite(tx, tenantId, bookingId);
      if (!booking || booking.status !== 'open') return;             // already moved on — no-op
      const version = booking.version;
      for (const a of await this.assignments.listPendingForUpdate(tx, tenantId, bookingId)) {
        a.expire();
        await this.assignments.update(tx, a);
        await this.flush(tx, tenantId, 'booking_assignment', a.id, a.pullEvents());
      }
      booking.expire();
      await this.bookings.update(tx, booking, version);
      await this.flush(tx, tenantId, 'labour_booking', booking.id, booking.pullEvents());
    }, { userId: 'system' });
  }

  // ---- reads ----
  async getBooking(tenantId: string, id: string) {
    const b = await this.bookings.getById(tenantId, id);
    if (!b) throw new BookingNotFoundError(id);
    return this.serializeBooking(b);
  }
  async listBookings(tenantId: string, actor: LabourActor, q: { box: 'mine' | 'open' | 'all'; status?: string; taskSkillId?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.canManage) throw new LabourForbiddenError('requires booking.manage');
    const rows = await this.bookings.listFor(tenantId, {
      employerUserId: q.box === 'mine' ? actor.userId : undefined, openOnly: q.box === 'open', status: q.status, taskSkillId: q.taskSkillId, cursor: q.cursor, limit: q.limit,
    });
    return this.page(rows.map((b) => this.serializeBooking(b)), q.limit);
  }
  async getAssignment(tenantId: string, id: string) {
    const a = await this.assignments.getById(tenantId, id);
    if (!a) throw new AssignmentNotFoundError(id);
    return this.serializeAssignment(a);
  }
  async listAssignments(tenantId: string, userId: string, q: { box: 'mine' | 'booking'; bookingId?: string; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    let workerId: string | undefined;
    if (q.box === 'mine') { const mine = await this.workers.findByUser(tenantId, userId); workerId = mine?.id ?? '00000000-0000-0000-0000-000000000000'; }
    const rows = await this.assignments.listFor(tenantId, { workerId, bookingId: q.box === 'booking' ? q.bookingId : undefined, status: q.status, cursor: q.cursor, limit: q.limit });
    return this.page(rows.map((a) => this.serializeAssignment(a)), q.limit);
  }

  // ---- helpers ----
  private async transitionBooking(tenantId: string, actor: LabourActor, bookingId: string, mutate: (b: LabourBooking, tx: TxContext) => Promise<void>) {
    if (!actor.canBook) throw new LabourForbiddenError('requires worker.book');
    return this.uow.run(tenantId, async (tx) => {
      const booking = await this.bookings.getForWrite(tx, tenantId, bookingId);
      if (!booking) throw new BookingNotFoundError(bookingId);
      this.assertOwnerOrManager(booking, actor);
      const version = booking.version;
      await mutate(booking, tx);
      await this.bookings.update(tx, booking, version);
      await this.flush(tx, tenantId, 'labour_booking', booking.id, booking.pullEvents());
      return this.serializeBooking(booking);
    }, { userId: actor.userId });
  }
  private assertOwnerOrManager(booking: LabourBooking, actor: LabourActor) {
    if (booking.employerUserId !== actor.userId && !actor.canManage) throw new LabourForbiddenError('only the employer or an admin may act on this booking');
  }
  private page<T extends { id: string; createdAt?: any }>(items: T[], limit: number) {
    const last = items[items.length - 1];
    const nextCursor = items.length === limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private serializeBooking(b: LabourBooking) {
    const v = b.toProps();
    return { id: v.id, bookingNo: v.bookingNo, employerUserId: v.employerUserId, demandTypeId: v.demandTypeId, taskSkillId: v.taskSkillId,
      workersNeeded: v.workersNeeded, startDate: v.startDate, endDate: v.endDate, wageKind: v.wageKind, wageOfferedMinor: v.wageOfferedMinor.toString(),
      minWageMinor: v.minWageMinor.toString(), currencyCode: v.currencyCode, womenOnly: v.womenOnly, status: v.status, respondBy: v.respondBy, version: v.version, createdAt: v.createdAt };
  }
  private serializeAssignment(a: BookingAssignment) {
    const v = a.toProps();
    return { id: v.id, bookingId: v.bookingId, workerId: v.workerId, status: v.status, wageMinor: v.wageMinor.toString(), acceptedAt: v.acceptedAt, createdAt: v.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, aggregateType: string, aggregateId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType, aggregateId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
