// modules/tenancy/read-models/tenant-analytics.read-model.ts · the tenant's own analytics dashboard (PRD §16.1).
// A TENANT-SCOPED read model (RLS backstop + explicit tenant_id in every query) — the tenant sees ONLY its own
// figures, never cross-tenant (the god-mode cross-tenant plane lives in apps/admin-api/platform-reports, Law 11).
// Every money figure is computed in SQL as SUM(...)::text bigint MINOR units (Law 2 — no float). Windowed on the
// partitioned `orders` table (partition-pruned, Law 8); top-N lists are bounded. View-/impression "traffic"
// (`listingViews`) is a REAL tenant-wide sum over the listing_view_counts read-model that the stream-processor's
// view_counter consumer feeds off the event pipeline (P1-15) — 0 until views land, never faked.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';

const TOPN = 5;
const REFUNDED = ['refunded', 'partially_refunded'];
const NON_GMV = ['cancelled'];   // cancelled orders don't count toward GMV

export interface TenantAnalytics {
  windowFrom: string; windowTo: string; currencyCode: string;
  gmvMinor: string; orders: number; commissionMinor: string; platformFeeMinor: string;
  refundedOrders: number; activeListings: number; disputesOpen: number; payoutsPaidMinor: string;
  listingViews: number;   // P1-15: tenant-wide per-impression listing views (real, fed by the event pipeline)
  topProducts: { productId: string; quantity: string; salesMinor: string }[];
  topSellers: { sellerUserId: string; orders: number; salesMinor: string }[];
}

@Injectable()
export class TenantAnalyticsReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async summary(tenantId: string, from: Date, to: Date, currency = 'INR'): Promise<TenantAnalytics> {
    const db = this.replica.forTenant(tenantId);
    const f = from.toISOString(), t = to.toISOString();

    const [orders, refunds, listings, disputes, payouts, views, topProducts, topSellers] = await Promise.all([
      db.query<any>(
        `SELECT COALESCE(SUM(total_minor),0)::text AS gmv, COALESCE(SUM(commission_minor),0)::text AS comm,
                COALESCE(SUM(platform_fee_minor),0)::text AS pf, COUNT(*)::int AS n
           FROM orders WHERE tenant_id=$1 AND currency_code=$4 AND created_at>=$2 AND created_at<$3
                       AND status <> ALL($5) AND deleted_at IS NULL`,
        [tenantId, f, t, currency, NON_GMV]),
      db.query<any>(
        `SELECT COUNT(*)::int AS n FROM orders WHERE tenant_id=$1 AND created_at>=$2 AND created_at<$3
            AND status = ANY($4) AND deleted_at IS NULL`, [tenantId, f, t, REFUNDED]),
      db.query<any>(`SELECT COUNT(*)::int AS n FROM listings WHERE tenant_id=$1 AND status='published' AND deleted_at IS NULL`, [tenantId]),
      db.query<any>(`SELECT COUNT(*)::int AS n FROM disputes WHERE tenant_id=$1 AND status NOT IN ('resolved','rejected','withdrawn') AND deleted_at IS NULL`, [tenantId]),
      db.query<any>(`SELECT COALESCE(SUM(amount_minor),0)::text AS paid FROM payouts WHERE tenant_id=$1 AND status='success' AND created_at>=$2 AND created_at<$3 AND deleted_at IS NULL`, [tenantId, f, t]),
      // P1-15: tenant-wide listing views — a real sum over the counted read-model fed by the event pipeline.
      db.query<any>(`SELECT COALESCE(SUM(total_views),0)::text AS v FROM listing_view_counts WHERE tenant_id=$1`, [tenantId]),
      db.query<any>(
        `SELECT oi.product_id, COALESCE(SUM(oi.quantity),0)::text AS qty, COALESCE(SUM(oi.line_total_minor),0)::text AS sales
           FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.tenant_id=oi.tenant_id
          WHERE oi.tenant_id=$1 AND o.created_at>=$2 AND o.created_at<$3 AND o.status <> ALL($4) AND o.deleted_at IS NULL
          GROUP BY oi.product_id ORDER BY SUM(oi.line_total_minor) DESC NULLS LAST LIMIT ${TOPN}`, [tenantId, f, t, NON_GMV]),
      db.query<any>(
        `SELECT seller_user_id, COUNT(*)::int AS orders, COALESCE(SUM(total_minor),0)::text AS sales
           FROM orders WHERE tenant_id=$1 AND created_at>=$2 AND created_at<$3 AND status <> ALL($4) AND deleted_at IS NULL
          GROUP BY seller_user_id ORDER BY SUM(total_minor) DESC NULLS LAST LIMIT ${TOPN}`, [tenantId, f, t, NON_GMV]),
    ]);
    const o = orders.rows[0] ?? {};
    return {
      windowFrom: f, windowTo: t, currencyCode: currency,
      gmvMinor: String(o.gmv ?? '0'), orders: o.n ?? 0, commissionMinor: String(o.comm ?? '0'), platformFeeMinor: String(o.pf ?? '0'),
      refundedOrders: refunds.rows[0]?.n ?? 0, activeListings: listings.rows[0]?.n ?? 0,
      disputesOpen: disputes.rows[0]?.n ?? 0, payoutsPaidMinor: String(payouts.rows[0]?.paid ?? '0'),
      listingViews: Number(views.rows[0]?.v ?? 0),
      topProducts: topProducts.rows.map((r: any) => ({ productId: r.product_id, quantity: String(r.qty ?? '0'), salesMinor: String(r.sales ?? '0') })),
      topSellers: topSellers.rows.map((r: any) => ({ sellerUserId: r.seller_user_id, orders: r.orders ?? 0, salesMinor: String(r.sales ?? '0') })),
    };
  }
}
