// modules/dairy/services/milk-collection.service.ts · record a milk collection at the MCC counter.
// The amount is PRICED by the active rate card (float-free bigint math). Weight/fat/snf arrive as decimal
// strings and are parsed to SCALED INTEGERS here (no float, Law: money correctness). One ACID tx (UoW),
// outbox in-tx (Law 4), idempotent (Law 3 + UNIQUE(membership,collected_on,shift)), authz THROWS (Law 6).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { MilkCollection } from '../domain/milk-collection.entity';
import { MilkShift, DomainEvent } from '../domain/dairy.events';
import { MilkCollectionRepository } from '../repositories/milk-collection.repository';
import { MilkRateCardRepository } from '../repositories/milk-rate-card.repository';
import { DairyMembershipRepository } from '../repositories/dairy-membership.repository';
import { RecordCollectionDto } from '../dto/create-milk-collection.dto';
import { MembershipNotFoundError, NoActiveRateCardError, DuplicateCollectionError, DairyForbiddenError } from '../domain/dairy.errors';
import { DairyActor } from './mcc-centre.service';

/** Parse a validated decimal string into a scaled integer (e.g. "12.345",3 → 12345n) — NO float. */
function parseScaled(s: string, decimals: number): bigint {
  const [int, frac = ''] = s.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(int + fracPadded);
}

@Injectable()
export class MilkCollectionService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: MilkCollectionRepository,
    private readonly rateCards: MilkRateCardRepository,
    private readonly memberships: DairyMembershipRepository,
  ) {}

  async record(tenantId: string, actor: DairyActor, idemKey: string, dto: RecordCollectionDto) {
    if (!actor.canManage) throw new DairyForbiddenError('requires dairy.manage');
    return this.idem.remember(idemKey, actor.userId, 'dairy.collection.record', () =>
      timed(this.metrics, 'dairy.collection.record', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const membership = await this.memberships.getById(tenantId, dto.membershipId, tx);
          if (!membership) throw new MembershipNotFoundError(dto.membershipId);
          const animalType = membership.defaultAnimalType ?? 'mixed';
          const card = await this.rateCards.resolveActive(tenantId, animalType, dto.collectedOn, tx);
          if (!card) throw new NoActiveRateCardError(animalType);
          const weightMilliKg = parseScaled(dto.weightKg, 3);
          const fatCentiPct = parseScaled(dto.fatPct, 2);
          const snfCentiPct = parseScaled(dto.snfPct, 2);
          const amountMinor = card.priceMinor(weightMilliKg, fatCentiPct, snfCentiPct);
          const collection = MilkCollection.record({
            id: uuidv7(), tenantId, mccId: membership.toProps().mccId, membershipId: membership.id, shift: dto.shift as MilkShift,
            collectedOn: dto.collectedOn, weightMilliKg, fatCentiPct, snfCentiPct, waterFlag: dto.waterFlag, adulterationFlags: dto.adulterationFlags,
            rateCardId: card.id, amountMinor, enteredBy: actor.userId,
          });
          try { await this.repo.insert(tx, collection); } catch (e: any) { if (e?.code === '23505') throw new DuplicateCollectionError(); throw e; }
          await this.flush(tx, tenantId, collection.id, collection.pullEvents());
          return this.serialize(collection);
        }, { userId: actor.userId })));
  }

  async list(tenantId: string, actor: DairyActor & { userId: string }, q: { membershipId: string; from: string; to: string; cursor?: { c: string; id: string }; limit: number }) {
    const membership = await this.memberships.getById(tenantId, q.membershipId);
    if (!membership) throw new MembershipNotFoundError(q.membershipId);
    if (membership.farmerUserId !== actor.userId && !actor.canManage) throw new MembershipNotFoundError(q.membershipId); // 404, no IDOR
    const rows = await this.repo.listFor(tenantId, q);
    const items = rows.map((c) => this.serialize(c));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.collectedOn}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private serialize(c: MilkCollection) {
    const v = c.toProps();
    return { id: v.id, membershipId: v.membershipId, mccId: v.mccId, shift: v.shift, collectedOn: v.collectedOn,
      weightKg: (Number(v.weightMilliKg) / 1000).toFixed(3), fatPct: (Number(v.fatCentiPct) / 100).toFixed(2), snfPct: (Number(v.snfCentiPct) / 100).toFixed(2),
      amountMinor: v.amountMinor.toString(), rateCardId: v.rateCardId, waterFlag: v.waterFlag, milkBillId: v.milkBillId, createdAt: v.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'milk_collection', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
