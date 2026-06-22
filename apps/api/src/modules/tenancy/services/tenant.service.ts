// modules/tenancy/services/tenant.service.ts · the IN-TENANT self-serve plane: a tenant admin views & edits its
// OWN tenant profile, submits onboarding for review, manages tenant-scoped settings, and reads its feature
// overrides + usage. Every read/write is scoped to ctx.tenantId (no id-from-request → no IDOR/cross-tenant
// enumeration). Writes: one ACID tx (UoW) + outbox event + audit row in the SAME tx + idempotency. Authorization
// THROWS (tenant.settings). LIFECYCLE (status) is NEVER touched here — that is god-mode in apps/admin-api (Law 11).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { Tenant } from '../domain/tenant.entity';
import { TenantSetting } from '../domain/tenant-settings.entity';
import { allowsSelfServeWrites } from '../domain/tenant.state';
import { DomainEvent } from '../domain/tenancy.events';
import { TenantNotFoundError, TenantForbiddenError, TenantNotWritableError, UnknownSettingError } from '../domain/tenancy.errors';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantSettingsRepository } from '../repositories/tenant-settings.repository';
import { TenantFeatureRepository } from '../repositories/tenant-feature.repository';
import { UsageCounterRepository } from '../repositories/usage-counter.repository';
import { UpdateTenantProfileDto } from '../dto/update-tenant.dto';
import { PutTenantSettingDto } from '../dto/create-tenant-settings.dto';
import { TenantActor } from '../policies/tenancy.policies';

@Injectable()
export class TenantService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly tenants: TenantRepository,
    private readonly settings: TenantSettingsRepository,
    private readonly features: TenantFeatureRepository,
    private readonly usage: UsageCounterRepository,
  ) {}

  private assertManager(a: TenantActor) { if (!a.canManage) throw new TenantForbiddenError(); }

  /** The caller's own tenant (read). */
  async getMine(tenantId: string) {
    const t = await this.tenants.getById(tenantId);
    if (!t) throw new TenantNotFoundError(tenantId);
    return this.serialize(t);
  }

  async updateProfile(tenantId: string, actor: TenantActor, idemKey: string, dto: UpdateTenantProfileDto, ip: string | null) {
    this.assertManager(actor);
    return this.idem.remember(idemKey, actor.userId, 'tenancy.tenant_profile_update', () =>
      timed(this.metrics, 'tenancy.tenant_profile_update', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const t = await this.tenants.getForUpdate(tx, tenantId);
          if (!t) throw new TenantNotFoundError(tenantId);
          if (!allowsSelfServeWrites(t.status)) throw new TenantNotWritableError(t.status);
          const diff = t.updateProfile(dto);
          await this.tenants.updateProfile(tx, t);
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'tenancy.tenant_profile_updated', entityType: 'tenant', entityId: tenantId, oldValue: diff.old, newValue: diff.new, ip });
          await this.flush(tx, tenantId, t.pullEvents());
          return this.serialize(t);
        }, { userId: actor.userId })));
  }

  /** Signal the god-mode plane that onboarding is ready for approval. Does NOT change status (Law 11). */
  async submitForReview(tenantId: string, actor: TenantActor, idemKey: string, ip: string | null) {
    this.assertManager(actor);
    return this.idem.remember(idemKey, actor.userId, 'tenancy.tenant_submit_review', () =>
      timed(this.metrics, 'tenancy.tenant_submit_review', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const t = await this.tenants.getForUpdate(tx, tenantId);
          if (!t) throw new TenantNotFoundError(tenantId);
          t.submitForReview();
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'tenancy.tenant_onboarding_submitted', entityType: 'tenant', entityId: tenantId, newValue: { status: t.status }, ip });
          await this.flush(tx, tenantId, t.pullEvents());
          return { ok: true, status: t.status };
        }, { userId: actor.userId })));
  }

  // ---- settings (tenant-scoped, typed) ----
  async listSettings(tenantId: string, limit: number) {
    return { items: await this.settings.listEffective(tenantId, limit) };
  }
  async putSetting(tenantId: string, actor: TenantActor, idemKey: string, dto: PutTenantSettingDto, ip: string | null) {
    this.assertManager(actor);
    return this.idem.remember(idemKey, actor.userId, 'tenancy.tenant_setting_put', () =>
      timed(this.metrics, 'tenancy.tenant_setting_put', { tenant: tenantId }, async () => {
        const def = await this.settings.findDefinition(tenantId, dto.key);
        if (!def) throw new UnknownSettingError(dto.key);
        const setting = TenantSetting.of(tenantId, def, dto.value);   // validates value_type + tenant scope (throws)
        return this.uow.run(tenantId, async (tx) => {
          await this.settings.upsert(tx, setting);
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'tenancy.tenant_setting_changed', entityType: 'tenant_setting', entityId: dto.key, newValue: { key: dto.key }, ip });
          await this.outbox.write(tx, { tenantId, aggregateType: 'tenant_setting', aggregateId: dto.key, eventType: 'tenancy.tenant_setting_changed', payload: { v: 1, tenantId, key: dto.key } });
          return { key: dto.key, value: setting.toProps().value };
        }, { userId: actor.userId });
      }));
  }

  // ---- read-only views (Law 11: overrides/usage are not self-settable) ----
  async listFeatures(tenantId: string) { return { items: (await this.features.listFor(tenantId)).map((f) => f.toJSON()) }; }
  async currentUsage(tenantId: string) { return { items: (await this.usage.currentPeriodFor(tenantId)).map((u) => u.toJSON()) }; }

  private serialize(t: Tenant) {
    const p = t.toProps();
    return { id: p.id, slug: p.slug, legalName: p.legalName, displayName: p.displayName, tenantTypeId: p.tenantTypeId,
      countryCode: p.countryCode, regionId: p.regionId, gstin: p.gstin, pan: p.pan, cinOrRegNo: p.cinOrRegNo,
      fssaiLicense: p.fssaiLicense, ownerName: p.ownerName, ownerPhone: p.ownerPhone, ownerEmail: p.ownerEmail,
      status: p.status, approvedAt: p.approvedAt ?? null, createdAt: p.createdAt ?? null };
  }
  private async flush(tx: TxContext, tenantId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'tenant', aggregateId: tenantId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
