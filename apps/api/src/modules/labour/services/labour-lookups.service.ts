// modules/labour/services/labour-lookups.service.ts · the labour TAXONOMY catalogue (read-only).
// Mobile/web pickers (work-type, skill tree, region, skill-level) must NOT be hard-coded to opaque UUIDs;
// this endpoint hands clients the human-labelled, server-canonical option sets so a booking can be posted
// with real ids. All sources are GLOBAL/master reference tables (no tenant_id → outside RLS): platform
// lookup_values, the skills tree, admin_regions (states), and the statutory minimum_wages skill levels.
// Every list is BOUNDED (no client can ask for an unbounded scan) and ordered for stable rendering.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { SKILL_LEVELS } from '../domain/labour.events';

const REGION_LIMIT = 100;   // state-level only — a small, fixed set
const SKILL_LIMIT = 500;    // the whole active skill tree is bounded and small

@Injectable()
export class LabourLookupsService {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** All taxonomy a client needs to render the booking/worker forms with real ids + labels. */
  async getAll(tenantId: string) {
    const db = this.replica.forTenant(tenantId);
    const [demandTypes, skills, regions] = await Promise.all([
      db.query<{ id: string; code: string; default_name: string }>(
        `SELECT id, code, default_name FROM lookup_values
          WHERE type_code='labour_demand_type' AND tenant_id IS NULL AND is_active=true
          ORDER BY sort_order, default_name`),
      db.query<{ id: string; code: string; default_name: string; tier: number; parent_id: string | null; is_hazardous: boolean }>(
        `SELECT id, code, default_name, tier, parent_id, is_hazardous FROM skills
          WHERE is_active=true ORDER BY tier, default_name LIMIT ${SKILL_LIMIT}`),
      db.query<{ id: string; code: string | null; default_name: string }>(
        `SELECT id, code, default_name FROM admin_regions
          WHERE level=1 AND is_active=true ORDER BY default_name LIMIT ${REGION_LIMIT}`),
    ]);
    return {
      workTypes: demandTypes.rows.map((r) => ({ id: r.id, code: r.code, name: r.default_name })),
      skills: skills.rows.map((r) => ({ id: r.id, code: r.code, name: r.default_name, tier: r.tier, parentId: r.parent_id, hazardous: r.is_hazardous })),
      regions: regions.rows.map((r) => ({ id: r.id, code: r.code, name: r.default_name })),
      skillLevels: [...SKILL_LEVELS],   // statutory floor tiers (minimum_wages.skill_level)
    };
  }
}
