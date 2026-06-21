// apps/admin-api/src/modules/schemes-registry-ops/services/eligibility-rules-editor.service.ts · the
// snapshot-affecting edit: eligibility_rules / benefit_summary / required_doc_type_ids / applicable_region_ids /
// processing_fee_minor. These change WHO is eligible + the entitlement, so the entity BUMPS schemes.version (PRD
// risk R18) — already-submitted scheme_applications keep their snapshotted scheme_version, while new applications
// snapshot the new one. One ACID tx: lock FOR UPDATE → entity.updateRules (version++) → UPDATE → a 'versioned'
// scheme_registry_changes row → an audit_log row, atomic. processing_fee_minor is bigint minor units (Law 2).
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { SchemesRegistryRepository } from '../repositories/schemes-registry.repository';
import { SchemeNotFoundError } from '../domain/schemes-registry.errors';
import { UpdateSchemeRulesDto } from '../dto/schemes-registry.dto';

@Injectable()
export class EligibilityRulesEditorService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: SchemesRegistryRepository) {}

  async updateRules(actor: AdminRequestContext, id: string, dto: UpdateSchemeRulesDto) {
    return this.pool.withTx(async (client) => {
      const scheme = await this.repo.getSchemeForUpdate(client, id);
      if (!scheme) throw new SchemeNotFoundError(id);
      const change = scheme.updateRules({
        benefitSummary: dto.benefitSummary, eligibilityRules: dto.eligibilityRules,
        requiredDocTypeIds: dto.requiredDocTypeIds, applicableRegionIds: dto.applicableRegionIds,
        processingFeeMinor: dto.processingFeeMinor,
      });   // validates + bumps version; throws SchemeAlreadyInState on a true no-op
      const p = scheme.persist;
      await this.repo.updateSchemeRules(client, id, {
        benefitSummary: p.benefitSummary, eligibilityRules: p.eligibilityRules, requiredDocTypeIds: p.requiredDocTypeIds,
        applicableRegionIds: p.applicableRegionIds, processingFeeMinor: p.processingFeeMinor, version: p.version, actorUserId: actor.userId,
      });
      await this.repo.insertChange(client, { entityType: 'scheme', entityId: id, action: 'versioned', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'schemes.scheme.versioned', entityType: 'scheme', entityId: id, oldValue: change.old, newValue: change.new, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return scheme.toJSON();
    });
  }
}
