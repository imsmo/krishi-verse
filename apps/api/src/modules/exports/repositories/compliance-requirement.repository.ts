// modules/exports/repositories/compliance-requirement.repository.ts · READ-ONLY compliance_requirements.
// GLOBAL reference data (no tenant_id) authored on the admin/platform surface (Law 11). Returns the rules
// in effect today for a destination country (+ optional category). Reads on the replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { ComplianceRequirement } from '../domain/compliance-requirement.entity';

const COLS = `id, destination_country, category_id, requirement_code, rules, effective_from, effective_to`;
const d = (v: any): string | null => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): ComplianceRequirement {
  return ComplianceRequirement.rehydrate({ id: r.id, destinationCountry: r.destination_country, categoryId: r.category_id, requirementCode: r.requirement_code, rules: r.rules ?? {}, effectiveFrom: d(r.effective_from)!, effectiveTo: d(r.effective_to) });
}
@Injectable()
export class ComplianceRequirementRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  /** Rules in effect TODAY for a destination (+ optional category). Global table; tenant only routes the conn. */
  async listInEffect(tenantId: string, destinationCountry: string, categoryId?: string): Promise<ComplianceRequirement[]> {
    const params: unknown[] = [destinationCountry];
    let where = `destination_country=$1 AND deleted_at IS NULL AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`;
    if (categoryId) { params.push(categoryId); where += ` AND (category_id=$2 OR category_id IS NULL)`; }
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM compliance_requirements WHERE ${where} ORDER BY requirement_code LIMIT 200`, params);
    return r.rows.map(toDomain);
  }
}
