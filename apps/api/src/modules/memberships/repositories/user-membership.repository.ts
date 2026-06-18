// modules/memberships/repositories/user-membership.repository.ts
// All SQL for user_memberships. tenant_id in EVERY query (Law 1) + RLS. No version column → mutations
// lock the row FOR UPDATE. Reads on the replica; the expiry job uses SKIP LOCKED.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { UserMembership } from '../domain/user-membership.entity';
import { MembershipStatus } from '../domain/user-membership.state';
import { BillingCycle } from '../domain/memberships.events';

const COLS = `id, tenant_id, user_id, tier_id, status, billing_cycle, current_period_end, payment_id, created_at`;
function toDomain(r: any): UserMembership {
  return UserMembership.rehydrate({
    id: r.id, tenantId: r.tenant_id, userId: r.user_id, tierId: r.tier_id, status: r.status as MembershipStatus,
    billingCycle: r.billing_cycle as BillingCycle, currentPeriodEnd: r.current_period_end, paymentId: r.payment_id, createdAt: r.created_at,
  });
}
export interface MembershipListQuery { userId?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class UserMembershipRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, m: UserMembership): Promise<void> {
    const v = m.toProps();
    await tx.query(
      `INSERT INTO user_memberships (id, tenant_id, user_id, tier_id, status, billing_cycle, current_period_end, payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [v.id, v.tenantId, v.userId, v.tierId, v.status, v.billingCycle, v.currentPeriodEnd, v.paymentId]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<UserMembership | null> {
    const r = await tx.query(`SELECT ${COLS} FROM user_memberships WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<UserMembership | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM user_memberships WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** The user's CURRENT live (active|past_due) membership, if any — the one-live guard + "my membership". */
  async findLiveForUser(tx: TxContext | null, tenantId: string, userId: string): Promise<UserMembership | null> {
    const sql = `SELECT ${COLS} FROM user_memberships WHERE tenant_id=$1 AND user_id=$2 AND status IN ('active','past_due') ORDER BY created_at DESC LIMIT 1`;
    const r = tx ? await tx.query(sql, [tenantId, userId]) : await this.replica.forTenant(tenantId).query(sql, [tenantId, userId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, m: UserMembership): Promise<void> {
    const v = m.toProps();
    await tx.query(`UPDATE user_memberships SET status=$3, current_period_end=$4, payment_id=$5, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [v.id, v.tenantId, v.status, v.currentPeriodEnd, v.paymentId]);
  }
  async listFor(tenantId: string, q: MembershipListQuery): Promise<UserMembership[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.userId) where += ` AND user_id=${p(q.userId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM user_memberships WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
  /** Worker finder (cross-tenant; kv_relay). Bounded + SKIP LOCKED; live memberships past their period end. */
  async findDueToExpire(tx: TxContext, now: Date, limit: number): Promise<UserMembership[]> {
    const r = await tx.query(
      `SELECT ${COLS} FROM user_memberships WHERE status IN ('active','past_due') AND current_period_end IS NOT NULL AND current_period_end < $1::date
        ORDER BY current_period_end LIMIT $2 FOR UPDATE SKIP LOCKED`, [now, limit]);
    return r.rows.map(toDomain);
  }
}
