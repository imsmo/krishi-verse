// modules/labour/repositories/worker_profiles.repository.ts · all SQL for worker_profiles.
// tenant_id in EVERY query (Law 1) + RLS. No version column → mutations lock the row FOR UPDATE.
// Reads on the replica; lists are keyset (never OFFSET).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { WorkerProfile, WorkerProfileProps } from '../domain/worker-profile.entity';

const COLS = `id, user_id, tenant_id, onboarded_by, age_verified_18, village_region_id, travel_km, stay_away_ok,
  min_wage_expectation_minor, auto_accept_above_minor, has_smartphone, emergency_contact_name, emergency_contact_phone,
  eshram_no, rating_avg, bookings_completed, no_show_count, discoverable, created_at`;
function toDomain(r: any): WorkerProfile {
  return WorkerProfile.rehydrate({
    id: r.id, userId: r.user_id, tenantId: r.tenant_id, onboardedBy: r.onboarded_by, ageVerified18: r.age_verified_18,
    villageRegionId: r.village_region_id, travelKm: r.travel_km, stayAwayOk: r.stay_away_ok,
    minWageExpectationMinor: r.min_wage_expectation_minor != null ? BigInt(r.min_wage_expectation_minor) : null,
    autoAcceptAboveMinor: r.auto_accept_above_minor != null ? BigInt(r.auto_accept_above_minor) : null,
    hasSmartphone: r.has_smartphone, emergencyContactName: r.emergency_contact_name, emergencyContactPhone: r.emergency_contact_phone,
    eshramNo: r.eshram_no, ratingAvg: r.rating_avg != null ? Number(r.rating_avg) : null,
    bookingsCompleted: r.bookings_completed, noShowCount: r.no_show_count, discoverable: r.discoverable === true, createdAt: r.created_at,
  });
}
export interface WorkerListQuery { villageRegionId?: string; ageVerified?: boolean; cursor?: { c: string; id: string }; limit: number; }

/** P0-2 consented, field-scoped worker CARD for the employer marketplace read. Name/rating/job-count are
 *  populated ONLY when the worker set discoverable=true; otherwise those fields are null (PII-minimised).
 *  `displayName` is the joined users.full_name — never persisted on the profile. */
export interface WorkerCard {
  id: string; userId: string; villageRegionId: string | null; travelKm: number; stayAwayOk: string;
  ageVerified: boolean; discoverable: boolean; createdAt?: Date;
  minWageExpectationMinor: string | null;   // the worker's declared expectation (a preference, not identity) — not consent-gated
  displayName: string | null; ratingAvg: number | null; bookingsCompleted: number | null;
}

@Injectable()
export class WorkerProfileRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, w: WorkerProfile): Promise<void> {
    const p = w.toProps();
    await tx.query(
      `INSERT INTO worker_profiles (id, user_id, tenant_id, onboarded_by, age_verified_18, village_region_id, travel_km,
         stay_away_ok, min_wage_expectation_minor, auto_accept_above_minor, has_smartphone, emergency_contact_name,
         emergency_contact_phone, eshram_no, discoverable, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$2)`,
      [p.id, p.userId, p.tenantId, p.onboardedBy, p.ageVerified18, p.villageRegionId, p.travelKm, p.stayAwayOk,
       p.minWageExpectationMinor?.toString() ?? null, p.autoAcceptAboveMinor?.toString() ?? null, p.hasSmartphone,
       p.emergencyContactName, p.emergencyContactPhone, p.eshramNo, p.discoverable]);
  }
  /** Replace the worker's self-declared skill set (worker_skills) in one tx. Idempotent: clears then
   *  re-inserts. An unknown skill id raises an FK violation (rejected — never a silent drop). */
  async setSkills(tx: TxContext, workerId: string, skillIds: string[]): Promise<void> {
    await tx.query(`DELETE FROM worker_skills WHERE worker_id=$1`, [workerId]);
    for (const skillId of [...new Set(skillIds)]) {
      await tx.query(`INSERT INTO worker_skills (worker_id, skill_id, level) VALUES ($1,$2,'self_declared')`, [workerId, skillId]);
    }
  }

  /** The worker's skill ids for the profile read (owner-scoped via the caller resolving their own worker). */
  async listSkillIds(tenantId: string, workerId: string): Promise<string[]> {
    const r = await this.replica.forTenant(tenantId).query<{ skill_id: string }>(`SELECT skill_id FROM worker_skills WHERE worker_id=$1`, [workerId]);
    return r.rows.map((x) => x.skill_id);
  }

  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<WorkerProfile | null> {
    const r = await tx.query(`SELECT ${COLS} FROM worker_profiles WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<WorkerProfile | null> {
    const sql = `SELECT ${COLS} FROM worker_profiles WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** The caller's own profile (user_id is UNIQUE) — the one-profile guard + "my profile". */
  async findByUser(tenantId: string, userId: string, tx?: TxContext): Promise<WorkerProfile | null> {
    const sql = `SELECT ${COLS} FROM worker_profiles WHERE tenant_id=$1 AND user_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [tenantId, userId]) : await this.replica.forTenant(tenantId).query(sql, [tenantId, userId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, w: WorkerProfile): Promise<void> {
    const p = w.toProps();
    await tx.query(
      `UPDATE worker_profiles SET village_region_id=$3, travel_km=$4, stay_away_ok=$5, min_wage_expectation_minor=$6,
         auto_accept_above_minor=$7, has_smartphone=$8, emergency_contact_name=$9, emergency_contact_phone=$10,
         eshram_no=$11, discoverable=$13, updated_at=now(), updated_by=$2
       WHERE id=$1 AND tenant_id=$12 AND deleted_at IS NULL`,
      [p.id, p.userId, p.villageRegionId, p.travelKm, p.stayAwayOk, p.minWageExpectationMinor?.toString() ?? null,
       p.autoAcceptAboveMinor?.toString() ?? null, p.hasSmartphone, p.emergencyContactName, p.emergencyContactPhone,
       p.eshramNo, p.tenantId, p.discoverable]);
  }
  async listFor(tenantId: string, q: WorkerListQuery): Promise<WorkerProfile[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.villageRegionId) where += ` AND village_region_id=${p(q.villageRegionId)}`;
    if (q.ageVerified !== undefined) where += ` AND age_verified_18=${p(q.ageVerified)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM worker_profiles WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  /** P0-2 consented employer marketplace read. Returns worker CARDS: identity fields (display name / rating /
   *  job-count) are populated by SQL ONLY where discoverable=true — CASE guards them at the source so a
   *  non-consenting worker's name never leaves the DB. Non-discoverable workers still appear as anonymous cards
   *  (region/travel/availability) so the employer can see supply without seeing PII. Keyset on created_at. */
  private mapCard(r: any): WorkerCard {
    const consented = r.discoverable === true;
    return {
      id: r.id, userId: r.user_id, villageRegionId: r.village_region_id, travelKm: r.travel_km, stayAwayOk: r.stay_away_ok,
      ageVerified: r.age_verified_18 === true, discoverable: consented, createdAt: r.created_at,
      minWageExpectationMinor: r.min_wage_expectation_minor != null ? String(r.min_wage_expectation_minor) : null,
      displayName: consented ? (r.display_name ?? null) : null,
      ratingAvg: consented && r.rating_avg != null ? Number(r.rating_avg) : null,
      bookingsCompleted: consented ? Number(r.bookings_completed) : null,
    };
  }
  private static readonly CARD_COLS = `wp.id, wp.user_id, wp.village_region_id, wp.travel_km, wp.stay_away_ok,
      wp.age_verified_18, wp.discoverable, wp.rating_avg, wp.bookings_completed, wp.min_wage_expectation_minor, wp.created_at,
      CASE WHEN wp.discoverable THEN u.full_name ELSE NULL END AS display_name`;  // name gated at the SOURCE
  async listCards(tenantId: string, q: WorkerListQuery): Promise<WorkerCard[]> {
    const params: unknown[] = [tenantId];
    let where = `wp.tenant_id=$1 AND wp.deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.villageRegionId) where += ` AND wp.village_region_id=${p(q.villageRegionId)}`;
    if (q.ageVerified !== undefined) where += ` AND wp.age_verified_18=${p(q.ageVerified)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (wp.created_at < ${cc} OR (wp.created_at=${cc} AND wp.id < ${ci}))`; }
    const lp = p(q.limit);
    const sql = `SELECT ${WorkerProfileRepository.CARD_COLS} FROM worker_profiles wp
      LEFT JOIN users u ON u.id = wp.user_id
      WHERE ${where} ORDER BY wp.created_at DESC, wp.id DESC LIMIT ${lp}`;
    const r = await this.replica.forTenant(tenantId).query(sql, params);
    return r.rows.map((row) => this.mapCard(row));
  }
  async getCard(tenantId: string, id: string): Promise<WorkerCard | null> {
    const sql = `SELECT ${WorkerProfileRepository.CARD_COLS} FROM worker_profiles wp
      LEFT JOIN users u ON u.id = wp.user_id
      WHERE wp.id=$1 AND wp.tenant_id=$2 AND wp.deleted_at IS NULL`;
    const r = await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? this.mapCard(r.rows[0]) : null;
  }
}
