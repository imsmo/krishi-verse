// modules/cms/jobs/banner-schedule.job.ts · the worker's banner-expiry runner.
// Connected as the BYPASSRLS relay role, it deactivates banners whose window has ended but are still is_active —
// keeping the `live` set tight without per-request work. Bounded per run; idempotent (only flips true→false).
import type { Pool } from 'pg';

export interface BannerExpiryResult { deactivated: number; }

export async function runBannerExpiry(relayPool: Pool, max = 1000): Promise<BannerExpiryResult> {
  const r = await relayPool.query(
    `UPDATE banners SET is_active=false, updated_at=now()
       WHERE id IN (SELECT id FROM banners WHERE is_active=true AND ends_at <= now() AND deleted_at IS NULL ORDER BY ends_at LIMIT $1)`, [max]);
  return { deactivated: r.rowCount ?? 0 };
}
