// modules/warehousing/services/nwr-receipt.service.ts · issue/release electronic Negotiable Warehouse Receipts.
// The receipt is issued against a STORED booking (the depositor becomes the holder). One active NWR per
// booking. valuation_minor is operator-supplied (auto-valuation from assay + mandi price is deferred).
// One ACID tx (UoW), state via the machine (Law 5), outbox in-tx (Law 4), authz THROWS (Law 6). No money
// here — pledging the receipt as loan collateral is the deferred fintech flow.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { NwrReceipt } from '../domain/nwr-receipt.entity';
import { NwrRepository, DomainEvent } from '../domain/warehousing.events';
import { NwrReceiptRepository } from '../repositories/nwr-receipt.repository';
import { StorageBookingRepository } from '../repositories/storage-booking.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { IssueNwrDto } from '../dto/create-nwr-receipt.dto';
import { BookingNotFoundError, BookingNotStoredError, NwrNotFoundError, NwrAlreadyIssuedError, EnwrExistsError, WarehouseNotFoundError, WarehousingForbiddenError } from '../domain/warehousing.errors';
import { WhActor } from './warehouse.service';

@Injectable()
export class NwrReceiptService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: NwrReceiptRepository,
    private readonly bookings: StorageBookingRepository,
    private readonly warehouses: WarehouseRepository,
  ) {}

  async issue(tenantId: string, actor: WhActor, idemKey: string, dto: IssueNwrDto, ip: string | null) {
    if (!actor.canManage) throw new WarehousingForbiddenError('requires warehouse.manage');
    return this.idem.remember(idemKey, actor.userId, 'warehousing.nwr.issue', () =>
      timed(this.metrics, 'warehousing.nwr.issue', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const booking = await this.bookings.getForUpdate(tx, tenantId, dto.storageBookingId);
          if (!booking) throw new BookingNotFoundError(dto.storageBookingId);
          if (booking.status !== 'stored') throw new BookingNotStoredError(booking.status);
          const warehouse = await this.warehouses.getBookable(tenantId, booking.warehouseId, tx);
          if (!warehouse || (warehouse.operatorUserId !== actor.userId && !actor.isAdmin)) throw new WarehousingForbiddenError('only the warehouse operator may issue an eNWR');
          if (await this.repo.findActiveForBooking(tx, tenantId, dto.storageBookingId)) throw new NwrAlreadyIssuedError();
          const nwr = NwrReceipt.issue({ id: uuidv7(), tenantId, storageBookingId: dto.storageBookingId, repository: dto.repository as NwrRepository, enwrNo: dto.enwrNo,
            holderUserId: booking.depositorUserId, quantityMilli: booking.quantityMilli, valuationMinor: BigInt(dto.valuationMinor), issuedAt: new Date(), expiresAt: dto.expiresAt ?? null });
          try { await this.repo.insert(tx, nwr); } catch (e: any) { if (e?.code === '23505') throw new EnwrExistsError(); throw e; }
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'warehousing.nwr.issued', entityType: 'nwr_receipt', entityId: nwr.id, newValue: { enwrNo: dto.enwrNo, valuationMinor: dto.valuationMinor }, ip });
          await this.flush(tx, tenantId, nwr.id, nwr.pullEvents());
          return nwr.toJSON();
        }, { userId: actor.userId })));
  }

  async release(tenantId: string, actor: WhActor, id: string) { return this.mutate(tenantId, actor, id, (n) => n.release()); }
  async cancel(tenantId: string, actor: WhActor, id: string) { return this.mutate(tenantId, actor, id, (n) => n.cancel()); }

  async getById(tenantId: string, actor: WhActor, id: string) {
    const n = await this.repo.getById(tenantId, id);
    if (!n) throw new NwrNotFoundError(id);
    if (n.holderUserId !== actor.userId && !actor.canManage && !actor.isAdmin) throw new NwrNotFoundError(id); // 404, no IDOR
    return n.toJSON();
  }
  async list(tenantId: string, actor: WhActor, q: { box: 'mine' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.canManage && !actor.isAdmin) throw new WarehousingForbiddenError('requires warehouse.manage');
    const rows = await this.repo.listFor(tenantId, { holderUserId: q.box === 'mine' ? actor.userId : undefined, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((n) => n.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private async mutate(tenantId: string, actor: WhActor, id: string, fn: (n: NwrReceipt) => void) {
    if (!actor.canManage) throw new WarehousingForbiddenError('requires warehouse.manage');
    return this.uow.run(tenantId, async (tx) => {
      const nwr = await this.repo.getForUpdate(tx, tenantId, id);
      if (!nwr) throw new NwrNotFoundError(id);
      fn(nwr);
      await this.repo.update(tx, nwr);
      await this.flush(tx, tenantId, nwr.id, nwr.pullEvents());
      return nwr.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'nwr_receipt', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
