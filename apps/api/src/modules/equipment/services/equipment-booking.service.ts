// modules/equipment/services/equipment-booking.service.ts · THE RENTAL MONEY PATH (escrow).
// request (renter, snapshots the asset's active rate) → quote (owner sets the advance/deposit) → confirm
// (renter; the advance is ESCROWED: renter userMain → platform Escrow) → start (OTP-gated) → complete
// (measured usage → final total) → SETTLE (owner): release the escrow to the owner, collect any shortfall
// from the renter, refund any unused hold — all zero-sum, idempotent wallet posts (Law 2). Every write:
// one ACID tx (UoW), state via the machine (Law 5), outbox in-tx (Law 4), idempotent money mutations
// (Law 3), authz THROWS (Law 6). No version column → bookings lock FOR UPDATE. Start OTP is HMAC-hashed.
import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomInt } from 'node:crypto';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { AppConfig } from '../../../core/config/app-config';
import { WALLET_SERVICE, WalletPort, LedgerLeg } from '../../../core/wallet/wallet.port';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { EquipmentBooking } from '../domain/equipment-booking.entity';
import { RateBasis, DomainEvent, EquipmentEventType } from '../domain/equipment.events';
import { EquipmentBookingRepository } from '../repositories/equipment-booking.repository';
import { EquipmentAssetRepository } from '../repositories/equipment-asset.repository';
import { EquipmentRateRepository } from '../repositories/equipment-rate.repository';
import { RequestBookingDto, QuoteBookingDto, StartBookingDto, CompleteBookingDto } from '../dto/create-equipment-booking.dto';
import { BookingNotFoundError, AssetNotFoundError, AssetNotBookableError, NoActiveRateError, EquipmentForbiddenError, InvalidBookingError } from '../domain/equipment.errors';
import { EquipmentActor } from './equipment-asset.service';

const bookingNo = (id: string) => `EQ-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 8).toUpperCase()}`;
const parseScaled = (s: string, dec: number): bigint => { const [i, f = ''] = s.split('.'); return BigInt(i + (f + '0'.repeat(dec)).slice(0, dec)); };

@Injectable()
export class EquipmentBookingService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly config: AppConfig,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly bookings: EquipmentBookingRepository,
    private readonly assets: EquipmentAssetRepository,
    private readonly rates: EquipmentRateRepository,
  ) {}

  private hashOtp(code: string): string { return createHmac('sha256', this.config.auth.hashPepper).update(code).digest('hex'); }

  // ---- renter: request (rate snapshotted from the asset's active card) ----
  async request(tenantId: string, actor: EquipmentActor, idemKey: string, dto: RequestBookingDto) {
    if (!actor.canRent) throw new EquipmentForbiddenError('requires equipment.rent');
    return this.idem.remember(idemKey, actor.userId, 'equipment.booking.request', () =>
      timed(this.metrics, 'equipment.booking.request', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const asset = await this.assets.getById(tenantId, dto.assetId, tx);
          if (!asset) throw new AssetNotFoundError(dto.assetId);
          if (!asset.isBookable) throw new AssetNotBookableError(asset.status);
          if (asset.ownerUserId === actor.userId) throw new InvalidBookingError('cannot rent your own asset');
          const onDate = dto.scheduledAt.slice(0, 10);
          const rate = await this.rates.resolveActive(tx, dto.assetId, dto.rateBasis, onDate);
          if (!rate) throw new NoActiveRateError(dto.rateBasis);
          const id = uuidv7();
          const booking = EquipmentBooking.request({ id, tenantId, bookingNo: bookingNo(id), renterUserId: actor.userId, assetId: dto.assetId,
            ownerUserId: asset.ownerUserId, operatorUserId: null, taskDesc: dto.taskDesc ?? null, rateBasis: dto.rateBasis as RateBasis,
            rateMinor: rate.rateMinor, estQuantityCenti: parseScaled(dto.estQuantity, 2), scheduledAt: new Date(dto.scheduledAt) });
          await this.bookings.insert(tx, booking);
          await this.flush(tx, tenantId, booking.id, booking.pullEvents());
          return booking.toJSON();
        }, { userId: actor.userId })));
  }

  // ---- owner: quote the advance/deposit ----
  async quote(tenantId: string, actor: EquipmentActor, id: string, dto: QuoteBookingDto) {
    return this.ownerMutate(tenantId, actor, id, (b) => b.quote(BigInt(dto.advanceMinor)));
  }

  // ---- renter: confirm → ESCROW the advance ----
  async confirm(tenantId: string, actor: EquipmentActor, id: string, idemKey: string) {
    if (!actor.canRent) throw new EquipmentForbiddenError('requires equipment.rent');
    return this.idem.remember(idemKey, actor.userId, 'equipment.booking.confirm', () =>
      timed(this.metrics, 'equipment.booking.confirm', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const booking = await this.bookings.getForUpdate(tx, tenantId, id);
          if (!booking) throw new BookingNotFoundError(id);
          if (booking.renterUserId !== actor.userId && !actor.isAdmin) throw new EquipmentForbiddenError('only the renter may confirm');
          const code = String(randomInt(100000, 999999));
          booking.confirm(this.hashOtp(code));
          if (booking.advanceMinor > 0n) {
            await this.wallet.post(tx, { tenantId, txnType: 'escrow_hold', idempotencyKey: `eqbook-hold:${booking.id}`, referenceType: 'equipment_booking', referenceId: booking.id, initiatedBy: actor.userId,
              legs: [{ account: userMain(booking.renterUserId), amountMinor: -booking.advanceMinor }, { account: platform(PlatformAccount.Escrow), amountMinor: booking.advanceMinor }] });
          }
          await this.bookings.update(tx, booking);
          await this.flush(tx, tenantId, booking.id, booking.pullEvents());
          // The OTP is delivered to the renter out-of-band (SMS relay, deferred); never returned in prod.
          return { ...booking.toJSON(), ...(this.config.auth.exposeOtp ? { startOtp: code } : {}) };
        }, { userId: actor.userId })));
  }

  // ---- owner/operator: start (OTP-gated) ----
  async start(tenantId: string, actor: EquipmentActor, id: string, dto: StartBookingDto) {
    return this.ownerMutate(tenantId, actor, id, (b) => b.start(this.hashOtp(dto.otp), new Date()));
  }
  // ---- owner/operator: complete with measured usage ----
  async complete(tenantId: string, actor: EquipmentActor, id: string, dto: CompleteBookingDto) {
    return this.ownerMutate(tenantId, actor, id, (b) => b.complete(parseScaled(dto.actualQuantity, 2), new Date()));
  }
  // ---- renter: cancel (requested/quoted/confirmed) — refunds any escrow ----
  async cancel(tenantId: string, actor: EquipmentActor, id: string, reason?: string) {
    return this.uow.run(tenantId, async (tx) => {
      const booking = await this.bookings.getForUpdate(tx, tenantId, id);
      if (!booking) throw new BookingNotFoundError(id);
      if (booking.renterUserId !== actor.userId && booking.ownerUserId !== actor.userId && !actor.isAdmin) throw new EquipmentForbiddenError('not a party to this booking');
      const refund = booking.status === 'confirmed' ? booking.advanceMinor : 0n;
      booking.cancel(reason);
      if (refund > 0n) {
        await this.wallet.post(tx, { tenantId, txnType: 'escrow_release', idempotencyKey: `eqbook-cancel-refund:${booking.id}`, referenceType: 'equipment_booking', referenceId: booking.id, initiatedBy: actor.userId,
          legs: [{ account: platform(PlatformAccount.Escrow), amountMinor: -refund }, { account: userMain(booking.renterUserId), amountMinor: refund }] });
      }
      await this.bookings.update(tx, booking);
      await this.flush(tx, tenantId, booking.id, booking.pullEvents());
      return booking.toJSON();
    }, { userId: actor.userId });
  }

  // ---- owner: SETTLE (completed → settled): escrow release + remainder/refund ----
  async settle(tenantId: string, actor: EquipmentActor, id: string, idemKey: string, ip: string | null) {
    if (!actor.canManage) throw new EquipmentForbiddenError('requires equipment.manage');
    return this.idem.remember(idemKey, actor.userId, 'equipment.booking.settle', () =>
      timed(this.metrics, 'equipment.booking.settle', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const booking = await this.bookings.getForUpdate(tx, tenantId, id);
          if (!booking) throw new BookingNotFoundError(id);
          if (booking.ownerUserId !== actor.userId && !actor.isAdmin) throw new EquipmentForbiddenError('only the owner may settle');
          const total = booking.totalMinor;
          if (total == null) throw new InvalidBookingError('booking is not completed');
          const advance = booking.advanceMinor;
          const payFromEscrow = advance < total ? advance : total;     // min(advance, total)
          const refundToRenter = advance > total ? advance - total : 0n; // unused hold back
          const shortfall = total > advance ? total - advance : 0n;      // renter still owes
          // 1) release escrow to the owner (escrow_release)
          if (payFromEscrow > 0n) await this.wallet.post(tx, { tenantId, txnType: 'escrow_release', idempotencyKey: `eqbook-release:${booking.id}`, referenceType: 'equipment_booking', referenceId: booking.id, initiatedBy: actor.userId,
            legs: [{ account: platform(PlatformAccount.Escrow), amountMinor: -payFromEscrow }, { account: userMain(booking.ownerUserId), amountMinor: payFromEscrow }] });
          // 2) refund any unused escrow to the renter
          if (refundToRenter > 0n) await this.wallet.post(tx, { tenantId, txnType: 'escrow_release', idempotencyKey: `eqbook-refund:${booking.id}`, referenceType: 'equipment_booking', referenceId: booking.id, initiatedBy: actor.userId,
            legs: [{ account: platform(PlatformAccount.Escrow), amountMinor: -refundToRenter }, { account: userMain(booking.renterUserId), amountMinor: refundToRenter }] });
          // 3) collect any shortfall from the renter (renter → owner)
          if (shortfall > 0n) await this.wallet.post(tx, { tenantId, txnType: 'order_payment', idempotencyKey: `eqbook-collect:${booking.id}`, referenceType: 'equipment_booking', referenceId: booking.id, initiatedBy: actor.userId,
            legs: [{ account: userMain(booking.renterUserId), amountMinor: -shortfall }, { account: userMain(booking.ownerUserId), amountMinor: shortfall }] });
          booking.markSettled();
          await this.bookings.update(tx, booking);
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'equipment.booking.settled', entityType: 'equipment_booking', entityId: booking.id, newValue: { totalMinor: total.toString(), advanceMinor: advance.toString() }, ip });
          await this.flush(tx, tenantId, booking.id, booking.pullEvents());
          return { ...booking.toJSON(), settledTotalMinor: total.toString() };
        }, { userId: actor.userId })));
  }

  // ---- reads ----
  async getById(tenantId: string, actor: EquipmentActor, id: string) {
    const b = await this.bookings.getById(tenantId, id);
    if (!b) throw new BookingNotFoundError(id);
    if (b.renterUserId !== actor.userId && b.ownerUserId !== actor.userId && !actor.isAdmin) throw new BookingNotFoundError(id); // 404, no cross-party IDOR
    return b.toJSON();
  }
  async list(tenantId: string, actor: EquipmentActor, q: { box: 'renter' | 'owner' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.isAdmin) throw new EquipmentForbiddenError('requires booking.manage');
    const rows = await this.bookings.listFor(tenantId, { renterUserId: q.box === 'renter' ? actor.userId : undefined, ownerUserId: q.box === 'owner' ? actor.userId : undefined, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((b) => b.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  // ---- worker job: timeout an un-confirmed booking past its scheduled time (refund not needed; no escrow yet) ----
  async timeout(tenantId: string, id: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const booking = await this.bookings.getForUpdate(tx, tenantId, id);
      if (!booking || (booking.status !== 'requested' && booking.status !== 'quoted')) return;
      booking.cancel('confirm_timeout');
      await this.bookings.update(tx, booking);
      await this.flush(tx, tenantId, booking.id, booking.pullEvents());
    }, { userId: 'system' });
  }

  private async ownerMutate(tenantId: string, actor: EquipmentActor, id: string, fn: (b: EquipmentBooking) => void) {
    if (!actor.canManage) throw new EquipmentForbiddenError('requires equipment.manage');
    return this.uow.run(tenantId, async (tx) => {
      const booking = await this.bookings.getForUpdate(tx, tenantId, id);
      if (!booking) throw new BookingNotFoundError(id);
      if (booking.ownerUserId !== actor.userId && !actor.isAdmin) throw new EquipmentForbiddenError('only the asset owner may act here');
      fn(booking);
      await this.bookings.update(tx, booking);
      await this.flush(tx, tenantId, booking.id, booking.pullEvents());
      return booking.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'equipment_booking', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
