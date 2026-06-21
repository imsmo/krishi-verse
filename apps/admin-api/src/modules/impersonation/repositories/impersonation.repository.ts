// apps/admin-api/src/modules/impersonation/repositories/impersonation.repository.ts · ALL SQL for impersonation.
// READS: target-user membership/privilege check (user_tenant_roles + roles.scope), grants (keyset list + single +
// FOR UPDATE), actions (keyset). WRITES (in the caller's tx): insert grant, close grant (end/revoke/expire), insert
// an action. impersonation_grants + impersonation_actions are GLOBAL/god-mode (target_tenant_id, not tenant_id) —
// operated only by kv_admin, every action audited. Parameterised; keyset (never OFFSET); bounded.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { ImpersonationGrant, GrantProps } from '../domain/grant.entity';
import { GrantStatus } from '../domain/grant.state';
import { ImpersonationScope } from '../domain/scope';
import { ActiveGrantExistsError } from '../domain/impersonation.errors';

function toGrant(r: any): ImpersonationGrant {
  const props: GrantProps = {
    id: r.id, adminUserId: r.admin_user_id, targetTenantId: r.target_tenant_id, targetUserId: r.target_user_id,
    reason: r.reason, scope: r.scope as ImpersonationScope, status: r.status as GrantStatus,
    expiresAt: r.expires_at, endedAt: r.ended_at ?? null, endedBy: r.ended_by ?? null, endReason: r.end_reason ?? null, createdAt: r.created_at ?? null,
  };
  return ImpersonationGrant.rehydrate(props);
}
const COLS = `id, admin_user_id, target_tenant_id, target_user_id, reason, scope, status, expires_at, ended_at, ended_by, end_reason, created_at`;

export interface GrantListQuery { adminUserId?: string; targetTenantId?: string; targetUserId?: string; status?: GrantStatus; cursor?: { c: string; id: string }; limit: number; }
export interface ActionListQuery { grantId: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class ImpersonationRepository {
  constructor(private readonly pool: AdminPool) {}

  /** Is the user an active member of the tenant, and do they hold ANY platform-scoped (privileged) role? */
  async findTenantUser(tenantId: string, userId: string): Promise<{ isPrivileged: boolean } | null> {
    const m = await this.pool.query(`SELECT 1 FROM user_tenant_roles WHERE user_id=$1 AND tenant_id=$2 AND is_active LIMIT 1`, [userId, tenantId]);
    if ((m.rowCount ?? 0) === 0) return null;   // not a member of THAT tenant ⇒ 404 (no cross-tenant enumeration)
    const priv = await this.pool.query(
      `SELECT 1 FROM user_tenant_roles utr JOIN roles r ON r.id = utr.role_id WHERE utr.user_id=$1 AND r.scope='platform' LIMIT 1`, [userId]);
    return { isPrivileged: (priv.rowCount ?? 0) > 0 };
  }

  /** Insert an active grant. The partial-unique index (one active per admin+target) → typed 409. */
  async insertGrant(client: PoolClient, g: { id: string; adminUserId: string; targetTenantId: string; targetUserId: string; reason: string; scope: ImpersonationScope; expiresAt: Date }): Promise<ImpersonationGrant> {
    try {
      const r = await client.query(
        `INSERT INTO impersonation_grants (id, admin_user_id, target_tenant_id, target_user_id, reason, scope, status, expires_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$2) RETURNING ${COLS}`,
        [g.id, g.adminUserId, g.targetTenantId, g.targetUserId, g.reason, g.scope, g.expiresAt.toISOString()]);
      return toGrant(r.rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') throw new ActiveGrantExistsError();
      throw e;
    }
  }

  async getGrant(id: string): Promise<ImpersonationGrant | null> {
    const r = await this.pool.query(`SELECT ${COLS} FROM impersonation_grants WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toGrant(r.rows[0]) : null;
  }
  async getGrantForUpdate(client: PoolClient, id: string): Promise<ImpersonationGrant | null> {
    const r = await client.query(`SELECT ${COLS} FROM impersonation_grants WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toGrant(r.rows[0]) : null;
  }

  async closeGrant(client: PoolClient, id: string, status: GrantStatus, endedBy: string, endReason: string, actorUserId: string): Promise<void> {
    await client.query(
      `UPDATE impersonation_grants SET status=$2, ended_at=now(), ended_by=$3, end_reason=$4, updated_by=$5, updated_at=now() WHERE id=$1`,
      [id, status, endedBy, endReason, actorUserId]);
  }

  async listGrants(q: GrantListQuery): Promise<ImpersonationGrant[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.adminUserId) where += ` AND admin_user_id=${p(q.adminUserId)}`;
    if (q.targetTenantId) where += ` AND target_tenant_id=${p(q.targetTenantId)}`;
    if (q.targetUserId) where += ` AND target_user_id=${p(q.targetUserId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${COLS} FROM impersonation_grants WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toGrant);
  }

  /* ---------------- impersonation_actions (append-only) ---------------- */
  async insertAction(client: PoolClient, a: { grantId: string; targetTenantId: string; method: string; path: string; action: string | null }): Promise<{ id: string; createdAt: Date }> {
    const r = await client.query(
      `INSERT INTO impersonation_actions (grant_id, target_tenant_id, method, path, action) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
      [a.grantId, a.targetTenantId, a.method, a.path, a.action]);
    return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
  }
  async listActions(q: ActionListQuery): Promise<any[]> {
    const params: unknown[] = [q.grantId]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'grant_id=$1';
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, grant_id, method, path, action, created_at FROM impersonation_actions WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, grantId: x.grant_id, method: x.method, path: x.path, action: x.action ?? null, createdAt: x.created_at }));
  }
}
