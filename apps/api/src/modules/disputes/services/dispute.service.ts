// modules/disputes/services/dispute.service.ts
// Dispute lifecycle use-cases. Every write: one ACID tx (UoW), status via the machine (Law 5), outbox
// events in the SAME tx (Law 4), audit on moderator actions. NO money moves here — resolving emits
// disputes.dispute_resolved (carrying the resolution) and orders applies the refund/release downstream;
// the wallet reversal itself is a flagged next step. The counterparty (against_user) is resolved from
// the order's eligibility (recorded at delivery) — never client-supplied (anti-IDOR). No version column
// → mutations lock the row FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Dispute } from '../domain/dispute.entity';
import { DisputeMessage } from '../domain/dispute-message.entity';
import { DomainEvent, ResolutionType } from '../domain/disputes.events';
import { isActive } from '../domain/dispute.state';
import { DisputeNotFoundError, DisputeForbiddenError, NotEligibleToDisputeError, DuplicateDisputeError, InvalidDisputeError, DisputeNotActiveError } from '../domain/disputes.errors';
import { DisputeRepository } from '../repositories/dispute.repository';
import { DisputeMessageRepository } from '../repositories/dispute-message.repository';
import { DisputeMessageService } from './dispute-message.service';
import { CreateDisputeDto } from '../dto/create-dispute.dto';
import { ResolveDisputeDto } from '../dto/update-dispute.dto';
import { CreateDisputeMessageDto } from '../dto/create-dispute-message.dto';

export interface DisputeActor { userId: string; canModerate: boolean; }
const SELLER_RESPOND_MS = 48 * 3600_000;   // respondent has 48h
const SLA_MS = 7 * 24 * 3600_000;          // platform SLA 7d

@Injectable()
export class DisputeService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: DisputeRepository,
    private readonly messages: DisputeMessageRepository,
    private readonly messageService: DisputeMessageService,
  ) {}

  /** A party to a delivered order raises a dispute against the counterparty. */
  async raise(tenantId: string, raisedBy: string, idemKey: string, dto: CreateDisputeDto) {
    return this.idem.remember(idemKey, raisedBy, 'disputes.raise', () =>
      timed(this.metrics, 'disputes.raise', { tenant: tenantId }, async () => {
        const elig = await this.repo.eligibilityFor(tenantId, dto.orderId);
        if (!elig) throw new NotEligibleToDisputeError();
        let againstUser: string;
        if (raisedBy === elig.buyerUserId) againstUser = elig.sellerUserId;
        else if (raisedBy === elig.sellerUserId) againstUser = elig.buyerUserId;
        else throw new NotEligibleToDisputeError();
        const reasonId = await this.repo.resolveReasonId(tenantId, dto.reasonCode);
        if (!reasonId) throw new InvalidDisputeError('unknown dispute reason');
        const now = new Date();
        const dispute = Dispute.raise({
          id: uuidv7(), tenantId, orderId: dto.orderId, raisedBy, againstUser, reasonId, description: dto.description ?? null,
          sellerRespondBy: new Date(now.getTime() + SELLER_RESPOND_MS), slaDueAt: new Date(now.getTime() + SLA_MS), now,
        });
        return this.uow.run(tenantId, async (tx) => {
          if (await this.repo.hasActiveForOrderRaiser(tx, tenantId, dto.orderId, raisedBy)) throw new DuplicateDisputeError();
          await this.repo.insert(tx, dispute);
          const p = dispute.toProps();
          await this.audit.write(tx, { tenantId, actorUserId: raisedBy, action: 'dispute.raised', entityType: 'dispute', entityId: p.id, newValue: { orderId: p.orderId, againstUser } });
          await this.flush(tx, tenantId, p.id, dispute.pullEvents());   // dispute_opened → orders pauses the order
          return this.serialize(p);
        }, { userId: raisedBy });
      }));
  }

  respond(t: string, a: DisputeActor, id: string) { return this.mutate(t, a, id, 'respond', {}, (d) => d.sellerRespond(a.userId)); }
  withdraw(t: string, a: DisputeActor, id: string) { return this.mutate(t, a, id, 'withdraw', {}, (d) => d.withdraw(a.userId)); }
  startReview(t: string, a: DisputeActor, id: string, ip: string | null) { return this.mutate(t, a, id, 'review', { moderator: true, audit: true }, (d) => d.startReview(), ip); }
  escalate(t: string, a: DisputeActor, id: string, ip: string | null) { return this.mutate(t, a, id, 'escalate', { moderator: true, audit: true }, (d) => d.escalate(), ip); }

  /** Moderator decision → resolved/rejected; emits dispute_resolved (orders applies refund/release). */
  resolve(tenantId: string, actor: DisputeActor, id: string, dto: ResolveDisputeDto, ip: string | null) {
    if (!actor.canModerate) throw new DisputeForbiddenError('requires dispute.resolve');
    return this.mutate(tenantId, actor, id, 'resolve', { moderator: true, audit: true },
      (d) => d.resolve(actor.userId, dto.resolutionType as ResolutionType, dto.resolutionAmountMinor ? BigInt(dto.resolutionAmountMinor) : null), ip, dto.note ?? null);
  }

  /** A party (or moderator) posts threaded evidence while the dispute is active. Delegated to the
   *  dedicated DisputeMessageService (the message use-cases live there). */
  postMessage(tenantId: string, actor: DisputeActor, id: string, dto: CreateDisputeMessageDto) {
    return this.messageService.post(tenantId, actor, id, dto);
  }

  listMessages(tenantId: string, actor: DisputeActor, id: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    return this.messageService.list(tenantId, actor, id, q);
  }

  async getById(tenantId: string, actor: DisputeActor, id: string) {
    const dispute = await this.repo.getById(tenantId, id);
    if (!dispute) throw new DisputeNotFoundError(id);
    if (!this.isParty(dispute, actor)) throw new DisputeNotFoundError(id);   // 404, not 403 (no enumeration)
    return this.serialize(dispute.toProps());
  }

  async list(tenantId: string, actor: DisputeActor, q: { box: 'raised' | 'against' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.canModerate) throw new DisputeForbiddenError('requires dispute.resolve');
    const filter = q.box === 'raised' ? { raisedBy: actor.userId } : q.box === 'against' ? { againstUser: actor.userId } : {};
    const rows = await this.repo.listFor(tenantId, { ...filter, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((d) => this.serialize(d.toProps()));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private async mutate(tenantId: string, actor: DisputeActor, id: string, action: string, opts: { moderator?: boolean; audit?: boolean }, apply: (d: Dispute) => void, ip: string | null = null, note: string | null = null) {
    return timed(this.metrics, `disputes.${action}`, { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const dispute = await this.repo.getForUpdate(tx, tenantId, id);
        if (!dispute) throw new DisputeNotFoundError(id);
        if (opts.moderator) { if (!actor.canModerate) throw new DisputeForbiddenError('requires dispute.resolve'); }
        else this.assertParty(dispute, actor);     // party-only actions (respond/withdraw) further checked in the entity
        apply(dispute);
        await this.repo.update(tx, dispute);
        if (opts.audit) await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `dispute.${action}`, entityType: 'dispute', entityId: id, newValue: { status: dispute.status }, reason: note, ip });
        await this.flush(tx, tenantId, id, dispute.pullEvents());
        return this.serialize(dispute.toProps());
      }, { userId: actor.userId }));
  }

  private isParty(d: Dispute, actor: DisputeActor): boolean { return actor.canModerate || d.raisedBy === actor.userId || d.againstUser === actor.userId; }
  private assertParty(d: Dispute, actor: DisputeActor): void { if (!this.isParty(d, actor)) throw new DisputeForbiddenError(); }

  private serialize(p: ReturnType<Dispute['toProps']>) {
    return { id: p.id, orderId: p.orderId, raisedBy: p.raisedBy, againstUser: p.againstUser, reasonId: p.reasonId,
      description: p.description, status: p.status, sellerRespondBy: p.sellerRespondBy,
      resolutionType: p.resolutionType, resolutionAmountMinor: p.resolutionAmountMinor?.toString() ?? null,
      resolvedBy: p.resolvedBy, resolvedAt: p.resolvedAt, slaDueAt: p.slaDueAt, createdAt: p.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, disputeId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'dispute', aggregateId: disputeId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
