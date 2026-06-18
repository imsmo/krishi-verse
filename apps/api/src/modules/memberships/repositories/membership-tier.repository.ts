// modules/memberships/repositories/membership-tier.repository.ts
// All SQL for membership_tiers. tenant_id in EVERY query (Law 1) + RLS. tenant_id NULL = a platform-
// standard tier (global, visible to all tenants; NOT mutable via the tenant API — Law 11). No version
// column (add_std_columns) → admin mutations lock the row FOR UPDATE. Reads on the replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { MembershipTier, parseBenefits } from '../domain/membership-tier.entity';

const COLS = `id, tenant_id, code, default_name, audience_role_id, monthly_fee_minor, annual_fee_minor,
  currency_code, platform_fee_bps_override, benefits, is_active, created_at`;
const big = (v: any) => (v == null ? null : BigInt(v));
function toDomain(r: any): MembershipTier {
  return MembershipTier.rehydrate({
    id: r.id, tenantId: r.tenant_id, code: r.code, defaultName: r.default_name, audienceRoleId: r.audience_role_id,
    monthlyFeeMinor: BigInt(r.monthly_fee_minor), annualFeeMinor: big(r.annual_fee_minor), currencyCode: r.currency_code,
    platformFeeBpsOverride: r.platform_fee_bps_override, benefits: parseBenefits(r.benefits), isActive: r.is_active, createdAt: r.created_at,
  });
}

@Injectable()
export class MembershipTierRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Returns false on a (tenant, code) uniqueness conflict. */
  async insert(tx: TxContext, t: MembershipTier): Promise<boolean> {
    const v = t.toProps();
    const r = await tx.query(
      `INSERT INTO membership_tiers (id, tenant_id, code, default_name, audience_role_id, monthly_fee_minor, annual_fee_minor, currency_code, platform_fee_bps_override, benefits, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) ON CONFLICT (tenant_id, code) DO NOTHING`,
      [v.id, v.tenantId, v.code, v.defaultName, v.audienceRoleId, v.monthlyFeeMinor.toString(), v.annualFeeMinor?.toString() ?? null,
       v.currencyCode, v.platformFeeBpsOverride, JSON.stringify(benefitsToJson(v.benefits)), v.isActive]);
    return (r.rowCount ?? 0) > 0;
  }
  /** Lock a TENANT-OWNED tier for an admin mutation (global NULL tiers are not mutable here — Law 11). */
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<MembershipTier | null> {
    const r = await tx.query(`SELECT ${COLS} FROM membership_tiers WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** A tier the tenant can subscribe to: its own OR a platform-standard (NULL) tier. */
  async getSubscribable(tenantId: string, id: string): Promise<MembershipTier | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM membership_tiers WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL)`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, t: MembershipTier): Promise<void> {
    const v = t.toProps();
    await tx.query(`UPDATE membership_tiers SET is_active=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [v.id, v.tenantId, v.isActive]);
  }
  /** Tenant tiers + platform-standard (NULL) tiers. Keyset (created_at DESC, id DESC) — never OFFSET. */
  async listFor(tenantId: string, q: { activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number }): Promise<MembershipTier[]> {
    const params: unknown[] = [tenantId];
    let where = `(tenant_id=$1 OR tenant_id IS NULL)`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.activeOnly) where += ` AND is_active=true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM membership_tiers WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}

function benefitsToJson(b: ReturnType<MembershipTier['toProps']>['benefits']): Record<string, unknown> {
  return { freeDelivery: b.freeDelivery, creditDays: b.creditDays ?? undefined, creditLimitMinor: b.creditLimitMinor?.toString() };
}
