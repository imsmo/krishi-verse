// apps/admin-api/src/modules/schemes-registry-ops/repositories/schemes-registry.repository.ts · ALL SQL for
// schemes-registry-ops. Reads + in-tx writes for the god-mode government-scheme master: scheme_authorities, the
// code-keyed versioned schemes catalogue, the scheme_category FK probe (over PLATFORM lookup_values), the
// open-on-date window calendar, and scheme_registry_changes history. Parameterised only; keyset paging (never
// OFFSET); writes take the caller's tx client; concurrency via SELECT … FOR UPDATE. processing_fee_minor is a
// bigint — bound to a STRING param (never a float) and read back as text.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { SchemeAuthority, AuthorityProps } from '../domain/scheme-authority.entity';
import { Scheme, SchemeProps } from '../domain/scheme.entity';

const AUTH_COLS = `id, default_name, level, region_id, created_at`;
function toAuthority(r: any): SchemeAuthority {
  const p: AuthorityProps = { id: r.id, defaultName: r.default_name, level: r.level, regionId: r.region_id ?? null, createdAt: r.created_at ?? null };
  return SchemeAuthority.rehydrate(p);
}
const SCHEME_COLS = `id, code, default_name, authority_id, category_id, benefit_summary, eligibility_rules, required_doc_type_ids, application_window, applicable_region_ids, processing_fee_minor::text AS processing_fee_minor, source_url, version, is_active, created_at`;
function toScheme(r: any): Scheme {
  const p: SchemeProps = {
    id: r.id, code: r.code, defaultName: r.default_name, authorityId: r.authority_id, categoryId: r.category_id,
    benefitSummary: r.benefit_summary ?? {}, eligibilityRules: r.eligibility_rules ?? {}, requiredDocTypeIds: r.required_doc_type_ids ?? [],
    applicationWindow: r.application_window ?? null, applicableRegionIds: r.applicable_region_ids ?? [],
    processingFeeMinor: BigInt(r.processing_fee_minor ?? '0'), sourceUrl: r.source_url ?? null, version: r.version, isActive: r.is_active, createdAt: r.created_at ?? null,
  };
  return Scheme.rehydrate(p);
}

export interface AuthorityListQuery { level?: string; cursor?: { c: string; id: string }; limit: number; }
export interface SchemeListQuery { authorityId?: string; categoryId?: string; isActive?: boolean; cursor?: { c: string; id: string }; limit: number; }
export interface CalendarQuery { onDate: string; cursor?: { c: string; id: string }; limit: number; }
export interface ChangeListQuery { entityType: 'authority' | 'scheme'; entityId: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class SchemesRegistryRepository {
  constructor(private readonly pool: AdminPool) {}

  /* ============================ scheme_authorities ============================ */
  async listAuthorities(q: AuthorityListQuery): Promise<SchemeAuthority[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.level) where += ` AND level=${p(q.level)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${AUTH_COLS} FROM scheme_authorities WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toAuthority);
  }
  async getAuthority(id: string): Promise<SchemeAuthority | null> {
    const r = await this.pool.query(`SELECT ${AUTH_COLS} FROM scheme_authorities WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toAuthority(r.rows[0]) : null;
  }
  async getAuthorityForUpdate(client: PoolClient, id: string): Promise<SchemeAuthority | null> {
    const r = await client.query(`SELECT ${AUTH_COLS} FROM scheme_authorities WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toAuthority(r.rows[0]) : null;
  }
  async insertAuthority(client: PoolClient, v: { defaultName: string; level: string; regionId: string | null; actorUserId: string }): Promise<{ id: string; createdAt: Date }> {
    const r = await client.query(
      `INSERT INTO scheme_authorities (default_name, level, region_id, created_by, updated_by) VALUES ($1,$2,$3,$4,$4) RETURNING id, created_at`,
      [v.defaultName, v.level, v.regionId, v.actorUserId]);
    return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
  }
  async updateAuthority(client: PoolClient, id: string, v: { defaultName: string; level: string; regionId: string | null; actorUserId: string }): Promise<void> {
    await client.query(`UPDATE scheme_authorities SET default_name=$2, level=$3, region_id=$4, updated_by=$5, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
      [id, v.defaultName, v.level, v.regionId, v.actorUserId]);
  }

  /* ============================ schemes ============================ */
  async listSchemes(q: SchemeListQuery): Promise<Scheme[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.authorityId) where += ` AND authority_id=${p(q.authorityId)}`;
    if (q.categoryId) where += ` AND category_id=${p(q.categoryId)}`;
    if (q.isActive !== undefined) where += ` AND is_active=${p(q.isActive)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${SCHEME_COLS} FROM schemes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toScheme);
  }
  async getScheme(id: string): Promise<Scheme | null> {
    const r = await this.pool.query(`SELECT ${SCHEME_COLS} FROM schemes WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toScheme(r.rows[0]) : null;
  }
  async getSchemeForUpdate(client: PoolClient, id: string): Promise<Scheme | null> {
    const r = await client.query(`SELECT ${SCHEME_COLS} FROM schemes WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toScheme(r.rows[0]) : null;
  }
  async schemeCodeExists(client: PoolClient, code: string): Promise<boolean> {
    const r = await client.query(`SELECT 1 FROM schemes WHERE code=$1 LIMIT 1`, [code]);   // code is UNIQUE (incl. soft-deleted)
    return (r.rowCount ?? 0) > 0;
  }
  /** category_id must be an ACTIVE PLATFORM lookup_value of type 'scheme_category'. */
  async isValidCategory(client: PoolClient, categoryId: string): Promise<boolean> {
    const r = await client.query(
      `SELECT 1 FROM lookup_values WHERE id=$1 AND type_code='scheme_category' AND tenant_id IS NULL AND is_active AND deleted_at IS NULL LIMIT 1`, [categoryId]);
    return (r.rowCount ?? 0) > 0;
  }
  async insertScheme(client: PoolClient, v: { code: string; defaultName: string; authorityId: string; categoryId: string; benefitSummary: unknown; eligibilityRules: unknown; requiredDocTypeIds: unknown; applicationWindow: unknown; applicableRegionIds: unknown; processingFeeMinor: string; sourceUrl: string | null; actorUserId: string }): Promise<{ id: string; createdAt: Date }> {
    const r = await client.query(
      `INSERT INTO schemes (code, default_name, authority_id, category_id, benefit_summary, eligibility_rules, required_doc_type_ids, application_window, applicable_region_ids, processing_fee_minor, source_url, version, is_active, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,1,false,$12,$12) RETURNING id, created_at`,
      [v.code, v.defaultName, v.authorityId, v.categoryId, JSON.stringify(v.benefitSummary), JSON.stringify(v.eligibilityRules), JSON.stringify(v.requiredDocTypeIds), v.applicationWindow != null ? JSON.stringify(v.applicationWindow) : null, JSON.stringify(v.applicableRegionIds), v.processingFeeMinor, v.sourceUrl, v.actorUserId]);
    return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
  }
  async updateSchemeMeta(client: PoolClient, id: string, v: { defaultName: string; authorityId: string; categoryId: string; sourceUrl: string | null; actorUserId: string }): Promise<void> {
    await client.query(`UPDATE schemes SET default_name=$2, authority_id=$3, category_id=$4, source_url=$5, updated_by=$6, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
      [id, v.defaultName, v.authorityId, v.categoryId, v.sourceUrl, v.actorUserId]);
  }
  async updateSchemeRules(client: PoolClient, id: string, v: { benefitSummary: unknown; eligibilityRules: unknown; requiredDocTypeIds: unknown; applicableRegionIds: unknown; processingFeeMinor: string; version: number; actorUserId: string }): Promise<void> {
    await client.query(
      `UPDATE schemes SET benefit_summary=$2::jsonb, eligibility_rules=$3::jsonb, required_doc_type_ids=$4::jsonb, applicable_region_ids=$5::jsonb, processing_fee_minor=$6, version=$7, updated_by=$8, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
      [id, JSON.stringify(v.benefitSummary), JSON.stringify(v.eligibilityRules), JSON.stringify(v.requiredDocTypeIds), JSON.stringify(v.applicableRegionIds), v.processingFeeMinor, v.version, v.actorUserId]);
  }
  async updateSchemeWindow(client: PoolClient, id: string, window: unknown, actorUserId: string): Promise<void> {
    await client.query(`UPDATE schemes SET application_window=$2::jsonb, updated_by=$3, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
      [id, window != null ? JSON.stringify(window) : null, actorUserId]);
  }
  async setSchemeActive(client: PoolClient, id: string, isActive: boolean, actorUserId: string): Promise<void> {
    await client.query(`UPDATE schemes SET is_active=$2, updated_by=$3, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [id, isActive, actorUserId]);
  }
  /** Active schemes whose application_window contains onDate ('MM-DD'); handles year-wrapping windows (opens>closes). */
  async schemesOpenOn(q: CalendarQuery): Promise<Scheme[]> {
    const params: unknown[] = [q.onDate]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = `is_active AND deleted_at IS NULL AND application_window ? 'opens' AND application_window ? 'closes'
      AND ((application_window->>'opens' <= application_window->>'closes' AND $1 BETWEEN application_window->>'opens' AND application_window->>'closes')
        OR (application_window->>'opens' > application_window->>'closes' AND ($1 >= application_window->>'opens' OR $1 <= application_window->>'closes')))`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${SCHEME_COLS} FROM schemes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toScheme);
  }

  /* ============================ scheme_registry_changes (append-only) ============================ */
  async insertChange(client: PoolClient, c: { entityType: 'authority' | 'scheme'; entityId: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string }): Promise<void> {
    await client.query(
      `INSERT INTO scheme_registry_changes (entity_type, entity_id, action, old_value, new_value, reason, actor_user_id) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)`,
      [c.entityType, c.entityId, c.action, c.oldValue != null ? JSON.stringify(c.oldValue) : null, c.newValue != null ? JSON.stringify(c.newValue) : null, c.reason, c.actorUserId]);
  }
  async listChanges(q: ChangeListQuery): Promise<any[]> {
    const params: unknown[] = [q.entityType, q.entityId]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'entity_type=$1 AND entity_id=$2';
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, entity_type, entity_id, action, old_value, new_value, reason, actor_user_id, created_at FROM scheme_registry_changes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, entityType: x.entity_type, entityId: x.entity_id, action: x.action, oldValue: x.old_value ?? null, newValue: x.new_value ?? null, reason: x.reason, actorUserId: x.actor_user_id, createdAt: x.created_at }));
  }
}
