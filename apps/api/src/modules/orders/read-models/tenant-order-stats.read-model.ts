// modules/orders/read-models/tenant-order-stats.read-model.ts
// CQRS dashboard read (Law 12): order counts by status + GMV for a tenant, off the REPLICA. A moderator
// sees the whole tenant; a seller is SCOPED to their own orders (anti-IDOR — never another seller's
// numbers). Bounded to a recent window (default 30d) so the partitioned orders scan is pruned. Money is
// bigint minor units returned as strings. One grouped query — no N+1.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';

export interface OrderStatusBucket { status: string; count: number; grossMinor: string; }
export interface TenantOrderStats { windowDays: number; sellerUserId: string | null; totalOrders: number; gmvMinor: string; byStatus: OrderStatusBucket[]; }

// GMV counts orders that represent realized revenue (delivered or completed).
const GMV_STATUSES = ['delivered', 'completed'];

@Injectable()
export class TenantOrderStatsReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async stats(tenantId: string, opts: { sellerUserId?: string | null; windowDays?: number } = {}): Promise<TenantOrderStats> {
    const windowDays = Math.min(Math.max(opts.windowDays ?? 30, 1), 365);
    const seller = opts.sellerUserId ?? null;
    const params: unknown[] = [tenantId, String(windowDays)];
    let scope = `tenant_id=$1 AND created_at > now() - ($2 || ' days')::interval`;
    if (seller) { params.push(seller); scope += ` AND seller_user_id=$${params.length}`; }
    const r = await this.replica.forTenant(tenantId).query<{ status: string; n: string; gross: string }>(
      `SELECT status, count(*)::text n, COALESCE(SUM(total_minor),0)::text gross FROM orders WHERE ${scope} GROUP BY status`, params);
    const byStatus = r.rows.map((x) => ({ status: x.status, count: Number(x.n), grossMinor: x.gross }));
    const totalOrders = byStatus.reduce((a, b) => a + b.count, 0);
    const gmv = byStatus.filter((b) => GMV_STATUSES.includes(b.status)).reduce((a, b) => a + BigInt(b.grossMinor), 0n);
    return { windowDays, sellerUserId: seller, totalOrders, gmvMinor: gmv.toString(), byStatus };
  }
}
