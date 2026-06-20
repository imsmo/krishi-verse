// modules/schemes/services/scheme-application.service.ts · the scheme APPLICATION lifecycle.
// apply (draft, snapshots the scheme's rule VERSION for integrity) → submit (collects the optional govt
// processing fee: applicant userMain → tenant 'main', txnType 'service_fee', zero-sum + idempotent — Law 2)
// → officer verify/clarify → approve/reject → (DBT recorded elsewhere → disbursed) → close; rejected →
// appeal. Every transition appends a row to the partitioned audit trail + an outbox event. One ACID tx
// (UoW), state via the machine (Law 5), idempotent money mutations (Law 3), authz THROWS (Law 6). FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain, TenantAccount } from '../../../core/wallet/account-codes';
import { AccountRef } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { SchemeApplication } from '../domain/scheme-application.entity';
import { DomainEvent } from '../domain/schemes.events';
import { SchemeApplicationRepository } from '../repositories/scheme-application.repository';
import { SchemeRepository } from '../repositories/scheme.repository';
import { ApplySchemeDto, ClarifyDto, ApproveDto, RejectDto } from '../dto/create-scheme-application.dto';
import { ApplicationNotFoundError, SchemeNotFoundError, SchemeInactiveError, SchemesForbiddenError } from '../domain/schemes.errors';
import { SchemesActor } from './dbt-transfer.service';

const QUOTA_METRIC = 'scheme_applications';
const tenantMain = (tenantId: string): AccountRef => ({ kind: 'tenant', tenantId, accountCode: TenantAccount.Main, currencyCode: 'INR' });

@Injectable()
export class SchemeApplicationService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly repo: SchemeApplicationRepository,
    private readonly schemes: SchemeRepository,
  ) {}

  async apply(tenantId: string, actor: SchemesActor, idemKey: string, dto: ApplySchemeDto) {
    if (!actor.canApply) throw new SchemesForbiddenError('requires scheme.apply');
    return this.idem.remember(idemKey, actor.userId, 'schemes.apply', () =>
      timed(this.metrics, 'schemes.apply', { tenant: tenantId }, async () => {
        await this.quota.assertWithinLimit(tenantId, QUOTA_METRIC);
        return this.uow.run(tenantId, async (tx) => {
          const scheme = await this.schemes.getById(tenantId, dto.schemeId, tx);
          if (!scheme) throw new SchemeNotFoundError(dto.schemeId);
          if (!scheme.isActive) throw new SchemeInactiveError(scheme.code);
          const app = SchemeApplication.draft({ id: uuidv7(), tenantId, schemeId: scheme.id, schemeVersion: scheme.version, applicantUserId: actor.userId, assistedBy: dto.assistedBy ?? null, formData: dto.formData, eligibilityCheck: null });
          await this.repo.insert(tx, app);
          await this.quota.increment(tx, tenantId, QUOTA_METRIC, 1);
          return app.toJSON();
        }, { userId: actor.userId });
      }));
  }

  /** Applicant submits the draft; collects the scheme's processing fee (if any) into the tenant pool. */
  async submit(tenantId: string, actor: SchemesActor, id: string, idemKey: string) {
    if (!actor.canApply) throw new SchemesForbiddenError('requires scheme.apply');
    return this.idem.remember(idemKey, actor.userId, 'schemes.submit', () =>
      timed(this.metrics, 'schemes.submit', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const app = await this.repo.getForUpdate(tx, tenantId, id);
          if (!app) throw new ApplicationNotFoundError(id);
          if (app.applicantUserId !== actor.userId) throw new SchemesForbiddenError('only the applicant may submit');
          const scheme = await this.schemes.getById(tenantId, app.schemeId, tx);
          if (!scheme) throw new SchemeNotFoundError(app.schemeId);
          const from = app.status;
          app.submit(new Date());
          await this.repo.update(tx, app);
          await this.repo.appendEvent(tx, tenantId, app.id, from, 'submitted', null, actor.userId);
          if (scheme.processingFeeMinor > 0n) {
            await this.wallet.post(tx, { tenantId, txnType: 'service_fee', idempotencyKey: `schemefee:${app.id}`, referenceType: 'scheme_application', referenceId: app.id, initiatedBy: actor.userId,
              legs: [{ account: userMain(actor.userId), amountMinor: -scheme.processingFeeMinor }, { account: tenantMain(tenantId), amountMinor: scheme.processingFeeMinor }] });
          }
          await this.flush(tx, tenantId, app.id, app.pullEvents());
          return { ...app.toJSON(), processingFeeMinor: scheme.processingFeeMinor.toString() };
        }, { userId: actor.userId })));
  }

  async startVerification(tenantId: string, actor: SchemesActor, id: string) { return this.transition(tenantId, actor, id, (a) => a.startVerification(), { officer: true }); }
  async requestClarification(tenantId: string, actor: SchemesActor, id: string, dto: ClarifyDto) { return this.transition(tenantId, actor, id, (a) => a.requestClarification(dto.note ?? null), { officer: true, note: dto.note ?? null }); }
  async resubmit(tenantId: string, actor: SchemesActor, id: string) { return this.transition(tenantId, actor, id, (a) => a.resubmit(), { applicant: true }); }
  async approve(tenantId: string, actor: SchemesActor, id: string, dto: ApproveDto, ip: string | null) { return this.transition(tenantId, actor, id, (a) => a.approve(dto.govtAppRef ?? null, new Date()), { officer: true, audit: { action: 'schemes.approved', ip, value: { govtAppRef: dto.govtAppRef ?? null } } }); }
  async reject(tenantId: string, actor: SchemesActor, id: string, dto: RejectDto, ip: string | null) { return this.transition(tenantId, actor, id, (a) => a.reject(dto.reason ?? null, new Date()), { officer: true, note: dto.reason ?? null, audit: { action: 'schemes.rejected', ip, value: { reason: dto.reason ?? null } } }); }
  async appeal(tenantId: string, actor: SchemesActor, id: string) { return this.transition(tenantId, actor, id, (a) => a.appeal(), { applicant: true }); }
  async close(tenantId: string, actor: SchemesActor, id: string) { return this.transition(tenantId, actor, id, (a) => a.close(), { officer: true }); }

  async getById(tenantId: string, actor: SchemesActor, id: string) {
    const a = await this.repo.getById(tenantId, id);
    if (!a) throw new ApplicationNotFoundError(id);
    if (a.applicantUserId !== actor.userId && !actor.canProcess) throw new ApplicationNotFoundError(id); // 404, no IDOR
    return a.toJSON();
  }
  async list(tenantId: string, actor: SchemesActor, q: { box: 'mine' | 'queue' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if ((q.box === 'queue' || q.box === 'all') && !actor.canProcess) throw new SchemesForbiddenError('requires scheme.process');
    const rows = await this.repo.listFor(tenantId, { applicantUserId: q.box === 'mine' ? actor.userId : undefined, queue: q.box === 'queue', status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((a) => a.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private async transition(tenantId: string, actor: SchemesActor, id: string, fn: (a: SchemeApplication) => void, opts: { officer?: boolean; applicant?: boolean; note?: string | null; audit?: { action: string; ip: string | null; value: Record<string, unknown> } }) {
    if (opts.officer && !actor.canProcess) throw new SchemesForbiddenError('requires scheme.process');
    if (opts.applicant && !actor.canApply) throw new SchemesForbiddenError('requires scheme.apply');
    return this.uow.run(tenantId, async (tx) => {
      const app = await this.repo.getForUpdate(tx, tenantId, id);
      if (!app) throw new ApplicationNotFoundError(id);
      if (opts.applicant && app.applicantUserId !== actor.userId) throw new SchemesForbiddenError('only the applicant may act here');
      const from = app.status;
      fn(app);
      await this.repo.update(tx, app);
      await this.repo.appendEvent(tx, tenantId, app.id, from, app.status, opts.note ?? null, actor.userId);
      if (opts.audit) await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: opts.audit.action, entityType: 'scheme_application', entityId: app.id, newValue: opts.audit.value, ip: opts.audit.ip });
      await this.flush(tx, tenantId, app.id, app.pullEvents());
      return app.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'scheme_application', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
