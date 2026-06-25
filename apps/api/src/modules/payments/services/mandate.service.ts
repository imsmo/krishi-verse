// modules/payments/services/mandate.service.ts
// UPI AutoPay mandate use-cases (autopay SETUP only — NO money moves here). Every write: one ACID tx
// (UoW) → status via the state machine (Law 5) → outbox event in the SAME tx (Law 4) → audit. Register
// is idempotent on the caller's key (Law 3). The raw VPA is masked in the domain before storage and is
// never logged. The mandate is created 'pending'; PSP confirmation (→ active) and the actual auto-debit
// collection (→ wallet ledger move) are a flagged provider-driven follow-on (webhook + worker).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Mandate } from '../domain/mandate.entity';
import { DomainEvent } from '../domain/payments.events';
import { MandateRepository } from '../repositories/mandate.repository';
import { GatewayRegistry } from '../gateway/gateway.registry';
import { RegisterMandateDto, CancelMandateDto } from '../dto/create-mandate.dto';
import { MandateNotFoundError, MandateAlreadyExistsError } from '../domain/payments.errors';

export interface MandateActor { userId: string; canModerate: boolean; }

@Injectable()
export class MandateService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: MandateRepository,
    private readonly gateways: GatewayRegistry,
  ) {}

  /** Register a pending UPI autopay mandate for the caller. One live mandate per (user, purpose). */
  async register(tenantId: string, userId: string, idemKey: string, dto: RegisterMandateDto, ip: string | null) {
    return this.idem.remember(idemKey, userId, 'payments.register_mandate', () =>
      timed(this.metrics, 'payments.register_mandate', { tenant: tenantId }, async () =>
        this.uow.run(tenantId, async (tx) => {
          const existing = await this.repo.findLiveByPurpose(tx, tenantId, userId, dto.purpose);
          if (existing) throw new MandateAlreadyExistsError(dto.purpose);
          const id = uuidv7();
          const mandate = Mandate.register({
            id, tenantId, userId, providerCode: this.gateways.default().providerCode, vpaRaw: dto.vpa,
            purpose: dto.purpose, maxAmountMinor: BigInt(dto.maxAmountMinor), currencyCode: dto.currencyCode,
            frequency: dto.frequency, validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          });
          await this.repo.insert(tx, mandate);
          await this.flush(tx, tenantId, id, mandate.pullEvents());
          // audit: never record the raw VPA — only the masked form the domain produced.
          await this.audit.write(tx, { tenantId, actorUserId: userId, action: 'mandate.registered', entityType: 'upi_mandate', entityId: id, newValue: { purpose: dto.purpose, maxAmountMinor: dto.maxAmountMinor, vpaMasked: mandate.toProps().vpaMasked }, ip });
          return this.serialize(mandate.toProps());
        }, { userId })));
  }

  async cancel(tenantId: string, actor: MandateActor, id: string, dto: CancelMandateDto, ip: string | null) {
    return timed(this.metrics, 'payments.cancel_mandate', { tenant: tenantId }, async () =>
      this.uow.run(tenantId, async (tx) => {
        const mandate = await this.repo.getForUpdate(tx, tenantId, id);
        // 404 (not 403) to a non-owner without moderation — no enumeration / IDOR.
        if (!mandate || (mandate.userId !== actor.userId && !actor.canModerate)) throw new MandateNotFoundError(id);
        const changed = mandate.cancel(dto.reason ?? null);
        if (changed) {
          await this.repo.update(tx, mandate);
          await this.flush(tx, tenantId, id, mandate.pullEvents());
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'mandate.cancelled', entityType: 'upi_mandate', entityId: id, newValue: { reason: dto.reason ?? null }, ip });
        }
        return this.serialize(mandate.toProps());
      }, { userId: actor.userId }));
  }

  async getById(tenantId: string, actor: MandateActor, id: string) {
    const mandate = await this.repo.getVisible(tenantId, id, actor.userId, actor.canModerate);
    if (!mandate) throw new MandateNotFoundError(id);
    return this.serialize(mandate.toProps());
  }

  async list(tenantId: string, userId: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    const items = (await this.repo.listForUser(tenantId, userId, q)).map((m) => this.serialize(m.toProps()));
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? Buffer.from(`${last.createdAt}|${last.id}`).toString('base64') : null };
  }

  private serialize(m: ReturnType<Mandate['toProps']>) {
    return { id: m.id, status: m.status, purpose: m.purpose, vpaMasked: m.vpaMasked, provider: m.providerCode,
      maxAmountMinor: m.maxAmountMinor.toString(), currencyCode: m.currencyCode, frequency: m.frequency,
      validUntil: m.validUntil, createdAt: m.createdAt };
  }

  private async flush(tx: TxContext, tenantId: string, mandateId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'upi_mandate', aggregateId: mandateId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
