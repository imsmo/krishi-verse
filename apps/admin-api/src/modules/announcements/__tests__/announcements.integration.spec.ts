// apps/admin-api/src/modules/announcements/__tests__/announcements.integration.spec.ts
// REAL end-to-end proof against a live Postgres (schema apps/api builds + migration 0040). Proves: create→schedule
// →publish→expire — asserting platform_announcements state, the schedule window, that the live-read surfaces it
// only while published-in-window, the announcement_changes timeline, and the audit_log rows. platform_announcements
// is GLOBAL/god-mode (no tenant_id ⇒ no RLS — kv_admin-only). Runs only when DATABASE_ADMIN_URL is set.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AdminConfig } from '../../../core/config/admin-config';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AnnouncementsRepository } from '../repositories/announcements.repository';
import { AnnouncementCrudService } from '../services/announcement-crud.service';

const APP_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
const run = APP_URL ? describe : describe.skip;

run('announcements (integration, real Postgres — lifecycle + live read + audit)', () => {
  let pool: AdminPool; let inspect: Pool; let svc: AnnouncementCrudService;
  const actor = { userId: randomUUID(), roles: ['platform_announcements_ops'], amr: ['hwk'], authTimeSec: Math.floor(Date.now() / 1000), sessionId: '', permissions: new Set(['announcements.manage']), ip: '10.0.0.1', requestId: 'itest' } as any;
  let id = '';
  const title = `ITest notice ${Date.now()}`;
  const endsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();

  beforeAll(async () => {
    const config = new AdminConfig({ NODE_ENV: 'test', DATABASE_ADMIN_URL: APP_URL, ADMIN_JWT_SECRET: 's'.repeat(40) });
    pool = new AdminPool(config);
    svc = new AnnouncementCrudService(pool, new AdminAuditWriter(pool), new AnnouncementsRepository(pool));
    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);

  afterAll(async () => {
    if (inspect) {
      if (id) {
        await inspect.query(`DELETE FROM announcement_changes WHERE announcement_id=$1`, [id]).catch(() => undefined);
        await inspect.query(`DELETE FROM platform_announcements WHERE id=$1`, [id]).catch(() => undefined);
      }
      await inspect.end();
    }
    await pool?.onModuleDestroy();
  });

  it('create→schedule→publish→expire: state, live-read, timeline + audit', async () => {
    const created: any = await svc.create(actor, { title, body: 'Scheduled maintenance window', severity: 'warning', placement: 'banner', plans: [], countries: [], reason: 'maintenance notice' });
    id = created.id;
    expect(created.status).toBe('draft');

    await svc.schedule(actor, id, { startsAt: new Date(Date.now() - 1000).toISOString(), endsAt, reason: 'set window' });
    await svc.publish(actor, id, { reason: 'go live' });

    const row = await inspect.query(`SELECT status, published_at, starts_at, ends_at FROM platform_announcements WHERE id=$1`, [id]);
    expect(row.rows[0].status).toBe('published');
    expect(row.rows[0].published_at).not.toBeNull();

    const live: any = await svc.active();
    expect(live.items.some((a: any) => a.id === id)).toBe(true);   // published + within window ⇒ surfaced

    await svc.expire(actor, id, 'maintenance completed');
    const after: any = await svc.active();
    expect(after.items.some((a: any) => a.id === id)).toBe(false);  // expired ⇒ no longer live

    const ch = await inspect.query(`SELECT count(*)::int AS c FROM announcement_changes WHERE announcement_id=$1 AND action IN ('created','scheduled','published','expired')`, [id]);
    expect(ch.rows[0].c).toBe(4);
    const au = await inspect.query(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id=$1 AND action LIKE 'announcements.%'`, [id]);
    expect(au.rows[0].c).toBe(4);
  });
});
