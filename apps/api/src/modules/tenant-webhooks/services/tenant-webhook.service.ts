// modules/tenant-webhooks/services/tenant-webhook.service.ts · the tenant's own webhook endpoints. register/rotate
// generate a signing secret, show it to the tenant ONCE, and persist only the AES-256-GCM-encrypted form (core/crypto
// secret-box; never plaintext, never a one-way hash — the delivery worker must reproduce the HMAC). URLs are SSRF-
// guarded (domain) before they are ever stored. event subscriptions are validated against the allow-list. All reads
// tenant-scoped (Law 1) + RLS; one ACID tx per write; audited (no secret in the audit). RBAC THROWS (tenant.settings).
import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { AppConfig } from '../../../core/config/app-config';
import { parseKek, seal } from '../../../core/crypto/secret-box';
import { WebhookRepository } from '../repositories/webhook.repository';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/create-webhook.dto';
import { isSafeWebhookUrl } from '../domain/webhook-ssrf';
import { isKnownWebhookEvent } from '../domain/webhook-events';
import { WebhookUrlUnsafeError, WebhookEventUnknownError, WebhookNotFoundError, WebhooksForbiddenError } from '../domain/tenant-webhooks.errors';

export interface WebhooksActor { userId: string; canManage: boolean; }
const DEV_KEK = '0000000000000000000000000000000000000000000000000000000000000000'; // dev-only fixed 32-byte hex

@Injectable()
export class TenantWebhookService {
  private readonly kek: Buffer;
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: WebhookRepository,
    config: AppConfig,
  ) {
    const raw = config.webhookSigningKek;
    if (!raw) {
      if (config.isProd) throw new Error('WEBHOOK_SIGNING_KEK must be set in production — refusing to start with no webhook signing key');
      this.kek = parseKek(DEV_KEK); // dev/test only
    } else {
      this.kek = parseKek(raw);
    }
  }

  private assertManager(a: WebhooksActor) { if (!a.canManage) throw new WebhooksForbiddenError(); }
  private validateEvents(types: string[]): string[] {
    const uniq = [...new Set(types)];
    for (const t of uniq) if (!isKnownWebhookEvent(t)) throw new WebhookEventUnknownError(t);
    return uniq;
  }
  private genSecret(): string { return `whsec_${randomBytes(24).toString('base64url')}`; }

  list(tenantId: string) {
    return timed(this.metrics, 'tenant_webhooks.list', { tenant: tenantId }, async () => {
      const rows = await this.repo.listForTenant(tenantId);
      return rows.map((r) => r.serialize());
    });
  }

  /** Register a new endpoint. Returns the signing secret ONCE (never stored or returned again). */
  async register(tenantId: string, actor: WebhooksActor, dto: CreateWebhookDto, ip: string | null) {
    this.assertManager(actor);
    const safe = isSafeWebhookUrl(dto.url);
    if (!safe.ok) throw new WebhookUrlUnsafeError(safe.reason);
    const events = this.validateEvents(dto.eventTypes);
    return timed(this.metrics, 'tenant_webhooks.register', { tenant: tenantId }, async () => {
      const secret = this.genSecret();
      const secretEnc = seal(this.kek, secret);
      const id = await this.uow.run(tenantId, async (tx) => {
        const newId = await this.repo.insert(tx, tenantId, dto.url, secretEnc, events);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'webhook.registered', entityType: 'webhook_endpoint', entityId: newId, newValue: { url: dto.url, eventTypes: events }, ip });
        return newId;
      }, { userId: actor.userId });
      return { id, url: dto.url, eventTypes: events, isActive: true, secret }; // secret shown ONCE
    });
  }

  async update(tenantId: string, actor: WebhooksActor, id: string, dto: UpdateWebhookDto, ip: string | null) {
    this.assertManager(actor);
    const events = dto.eventTypes ? this.validateEvents(dto.eventTypes) : undefined;
    return timed(this.metrics, 'tenant_webhooks.update', { tenant: tenantId }, async () => {
      await this.uow.run(tenantId, async (tx) => {
        if (!(await this.repo.getForUpdate(tx, tenantId, id))) throw new WebhookNotFoundError(id);
        await this.repo.update(tx, tenantId, id, { eventTypes: events, isActive: dto.isActive });
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'webhook.updated', entityType: 'webhook_endpoint', entityId: id, newValue: { eventTypes: events, isActive: dto.isActive }, ip });
      }, { userId: actor.userId });
      return { id, ok: true };
    });
  }

  /** Rotate the signing secret. Returns the new secret ONCE. */
  async rotateSecret(tenantId: string, actor: WebhooksActor, id: string, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'tenant_webhooks.rotate', { tenant: tenantId }, async () => {
      const secret = this.genSecret();
      const secretEnc = seal(this.kek, secret);
      await this.uow.run(tenantId, async (tx) => {
        if (!(await this.repo.getForUpdate(tx, tenantId, id))) throw new WebhookNotFoundError(id);
        await this.repo.rotateSecret(tx, tenantId, id, secretEnc);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'webhook.secret_rotated', entityType: 'webhook_endpoint', entityId: id, ip });
      }, { userId: actor.userId });
      return { id, secret }; // shown ONCE
    });
  }

  async remove(tenantId: string, actor: WebhooksActor, id: string, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'tenant_webhooks.remove', { tenant: tenantId }, async () => {
      await this.uow.run(tenantId, async (tx) => {
        const n = await this.repo.remove(tx, tenantId, id);
        if (n === 0) throw new WebhookNotFoundError(id);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'webhook.deleted', entityType: 'webhook_endpoint', entityId: id, ip });
      }, { userId: actor.userId });
      return { id, ok: true };
    });
  }
}
