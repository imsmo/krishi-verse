// modules/tenancy/services/tenant-domain.service.ts · self-serve custom-domain management for the caller's tenant.
// Add (TLS pending → platform verifies), list, make-primary (only a verified domain; demotes the prior primary in
// the SAME tx), remove. Every write: one ACID tx (UoW) + outbox event + audit row in the same tx + idempotency on
// create. Authorization THROWS (tenant.settings). All queries are tenant-scoped (RLS + tenant_id) — no IDOR.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { TenantDomain } from '../domain/tenant-domain.entity';
import { DomainEvent, TenancyEventType } from '../domain/tenancy.events';
import { TenantDomainNotFoundError, TenantForbiddenError } from '../domain/tenancy.errors';
import { TenantDomainRepository } from '../repositories/tenant-domain.repository';
import { CreateTenantDomainDto } from '../dto/create-tenant-domain.dto';
import { TenantActor } from '../policies/tenancy.policies';

const encodeCursor = (createdAt: Date | string | null, id: string) => Buffer.from(`${createdAt instanceof Date ? createdAt.toISOString() : String(createdAt)}|${id}`).toString('base64');

@Injectable()
export class TenantDomainService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: TenantDomainRepository,
  ) {}

  private assertManager(a: TenantActor) { if (!a.canManage) throw new TenantForbiddenError(); }

  async add(tenantId: string, actor: TenantActor, idemKey: string, dto: CreateTenantDomainDto, ip: string | null) {
    this.assertManager(actor);
    return this.idem.remember(idemKey, actor.userId, 'tenancy.domain_add', () =>
      timed(this.metrics, 'tenancy.domain_add', { tenant: tenantId }, () => {
        const d = TenantDomain.create({ id: uuidv7(), tenantId, domain: dto.domain });
        return this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, d);
          const p = d.toProps();
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'tenancy.tenant_domain_added', entityType: 'tenant_domain', entityId: p.id, newValue: { domain: p.domain }, ip });
          await this.flush(tx, tenantId, p.id, d.pullEvents());
          return this.serialize(d);
        }, { userId: actor.userId });
      }));
  }

  async makePrimary(tenantId: string, actor: TenantActor, id: string, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'tenancy.domain_make_primary', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const d = await this.repo.getForUpdate(tx, tenantId, id);
        if (!d) throw new TenantDomainNotFoundError(id);
        await this.repo.clearPrimary(tx, tenantId);              // demote whoever is primary now
        d.makePrimary();                                          // throws unless verified
        await this.repo.update(tx, d);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'tenancy.tenant_domain_primary_changed', entityType: 'tenant_domain', entityId: id, newValue: { isPrimary: true }, ip });
        await this.flush(tx, tenantId, id, d.pullEvents());
        return this.serialize(d);
      }, { userId: actor.userId }));
  }

  async remove(tenantId: string, actor: TenantActor, id: string, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'tenancy.domain_remove', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const d = await this.repo.getForUpdate(tx, tenantId, id);
        if (!d) throw new TenantDomainNotFoundError(id);
        await this.repo.remove(tx, tenantId, id);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'tenancy.tenant_domain_removed', entityType: 'tenant_domain', entityId: id, oldValue: { domain: d.toProps().domain }, ip });
        await this.outbox.write(tx, { tenantId, aggregateType: 'tenant_domain', aggregateId: id, eventType: TenancyEventType.TenantDomainRemoved, payload: { v: 1, tenantId, domainId: id } });
        return { ok: true };
      }, { userId: actor.userId }));
  }

  async list(tenantId: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.list(tenantId, q);
    const items = rows.map((d) => this.serialize(d));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? encodeCursor(last.createdAt, last.id) : null;
    return { items, nextCursor };
  }

  private serialize(d: TenantDomain) {
    const p = d.toProps();
    return { id: p.id, domain: p.domain, isPrimary: p.isPrimary, tlsStatus: p.tlsStatus, verified: p.verifiedAt != null, verifiedAt: p.verifiedAt, createdAt: p.createdAt ?? null };
  }
  private async flush(tx: TxContext, tenantId: string, aggregateId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'tenant_domain', aggregateId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
