// modules/payments/services/commission-rule.service.ts · tenant finance admins manage their OWN commission-rule
// OVERRIDES (the Revenue Playbook as data). Platform-default rules (tenant_id NULL) are god-mode (admin-api) and
// are never written here — every write binds tenant_id = ctx.tenantId. Each write is one ACID tx (UoW) + audit row
// in the same tx + idempotency on create; authorization THROWS. These rules are CONFIG (rates/bps); they move no
// money themselves — settlement (which DOES move money, via wallet-service) resolves the best rule at order time.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { CommissionRuleRepository, CommissionRuleRow } from '../repositories/commission-rule.repository';
import { CreateCommissionRuleDto } from '../dto/create-commission-rule.dto';
import { QueryCommissionRuleDto } from '../dto/query-commission-rule.dto';
import { InvalidCommissionRuleError, CommissionRuleForbiddenError, CommissionRuleNotFoundError } from '../domain/commission.errors';

export interface CommissionActor { userId: string; canManage: boolean; }
const today = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class CommissionRuleService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: CommissionRuleRepository,
  ) {}

  private assertManager(a: CommissionActor) { if (!a.canManage) throw new CommissionRuleForbiddenError('managing commission rules requires finance permission'); }

  async create(tenantId: string, actor: CommissionActor, idemKey: string, dto: CreateCommissionRuleDto, ip: string | null) {
    this.assertManager(actor);
    // domain invariants (rates already 0..100000 via zod; platform share is a share OF the commission ⇒ ≤ 10000 bps)
    if (dto.platformShareBps > 10000) throw new InvalidCommissionRuleError('platform_share_bps is a share of commission and cannot exceed 10000 (100%)');
    const effFrom = dto.effectiveFrom ?? today();
    if (dto.effectiveTo && dto.effectiveTo < effFrom) throw new InvalidCommissionRuleError('effective_to must be on/after effective_from');
    const capMinor = dto.capMinor == null ? null : String(dto.capMinor);
    return this.idem.remember(idemKey, actor.userId, 'payments.commission_rule_create', () =>
      timed(this.metrics, 'payments.commission_rule_create', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const id = uuidv7();
          await this.repo.insert(tx, {
            id, tenantId, categoryId: dto.categoryId ?? null, source: dto.source ?? null, sellerRoleId: dto.sellerRoleId ?? null,
            rateBps: dto.rateBps, fixedMinor: String(dto.fixedMinor), capMinor, platformShareBps: dto.platformShareBps,
            chargedTo: dto.chargedTo, priority: dto.priority, effectiveFrom: effFrom, effectiveTo: dto.effectiveTo ?? null, isActive: true,
          });
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'payments.commission_rule_created', entityType: 'commission_rule', entityId: id, newValue: { rateBps: dto.rateBps, platformShareBps: dto.platformShareBps, chargedTo: dto.chargedTo }, ip });
          return { id, rateBps: dto.rateBps, platformShareBps: dto.platformShareBps, chargedTo: dto.chargedTo, effectiveFrom: effFrom, isActive: true };
        }, { userId: actor.userId })));
  }

  async setActive(tenantId: string, actor: CommissionActor, id: string, isActive: boolean, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'payments.commission_rule_set_active', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const rule = await this.repo.getForUpdate(tx, tenantId, id);   // NULL-tenant rows never returned → 404 (no god-mode edits)
        if (!rule) throw new CommissionRuleNotFoundError(id);
        await this.repo.setActive(tx, tenantId, id, isActive);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `payments.commission_rule_${isActive ? 'activated' : 'deactivated'}`, entityType: 'commission_rule', entityId: id, oldValue: { isActive: rule.isActive }, newValue: { isActive }, ip });
        return { id, isActive };
      }, { userId: actor.userId }));
  }

  async list(tenantId: string, q: Omit<QueryCommissionRuleDto, 'cursor'> & { cursor?: { c: string; id: string } }) {
    const rows = await this.repo.list(tenantId, { activeOnly: q.activeOnly, includePlatformDefaults: q.includePlatformDefaults, cursor: q.cursor, limit: q.limit });
    const items = rows.map((r) => this.serialize(r));
    const last = rows[rows.length - 1];
    const nextCursor = rows.length === q.limit && last ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private serialize(r: CommissionRuleRow) {
    return { id: r.id, scope: r.tenantId == null ? 'platform' : 'tenant', categoryId: r.categoryId, source: r.source, sellerRoleId: r.sellerRoleId,
      rateBps: r.rateBps, fixedMinor: r.fixedMinor, capMinor: r.capMinor, platformShareBps: r.platformShareBps, chargedTo: r.chargedTo,
      priority: r.priority, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo, isActive: r.isActive };
  }
}
