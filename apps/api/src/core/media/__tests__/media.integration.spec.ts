// core/media/__tests__/media.integration.spec.ts
// REAL proof of the media lifecycle against a live Postgres (presigning is local crypto, so no S3
// is contacted): request → 'pending' row; download is WITHHELD until clean; a signature-verified AV
// callback flips it to clean → download returns a presigned URL; an infected file stays blocked; a
// stranger gets 404 (IDOR-safe); cross-tenant RLS denies tenant B from seeing tenant A's asset.
import { randomUUID, createHmac } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant, makeUser } from '../../../../test/helpers/fixtures';

import { AppConfig } from '../../config/app-config';
import { PgPoolProvider } from '../../database/pg-pool.provider';
import { ShardRouter } from '../../sharding/shard-router';
import { PgUnitOfWork } from '../../database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../database/read-replica.pg';
import { PromMetrics } from '../../observability/metrics.prom';
import { ResilienceService } from '../../resilience/resilience.service';
import { ObjectStore } from '../s3-presign.service';
import { MediaRepository } from '../media.repository';
import { MediaService } from '../media-links.service';
import { MediaNotScannedError, MediaNotFoundError } from '../media.domain';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const SCAN_SECRET = 'scan-secret-itest';
const run = APP_URL ? describe : describe.skip;

run('media presign + scan gate (integration, real Postgres + RLS)', () => {
  let pools: PgPoolProvider;
  let admin: Pool;
  let inspect: Pool;
  let media: MediaService;
  let isSuperuser = false;

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const user = randomUUID();
  const stranger = randomUUID();
  const sha = 'a'.repeat(64);
  const actor = (u: string) => ({ userId: u, canModerate: false });
  const scan = (s3Key: string, status: string) => {
    const body = JSON.stringify({ s3_key: s3Key, status });
    return { body, sig: createHmac('sha256', SCAN_SECRET).update(body).digest('hex') };
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    await makeUser(admin, user); await makeUser(admin, stranger);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1',
      S3_MEDIA_BUCKET: 'kv-test', S3_ACCESS_KEY_ID: 'AKIDTEST', S3_SECRET_ACCESS_KEY: 'sk-test', MEDIA_SCAN_SECRET: SCAN_SECRET });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    const uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const metrics = new PromMetrics();
    const store = new ObjectStore(config, new ResilienceService(metrics));
    media = new MediaService(uow, metrics, config, store, new MediaRepository(replica as any));

    inspect = new Pool({ connectionString: APP_URL });
    isSuperuser = (await inspect.query(`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`)).rows[0]?.rolsuper === true;
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  let mediaId = ''; let s3Key = '';

  it('request → pending row + presigned upload URL; download withheld until clean', async () => {
    const res = await media.requestUpload(tenantA, user, { kind: 'document', mimeType: 'application/pdf', declaredBytes: 1000 } as any);
    mediaId = res.mediaId; s3Key = res.s3Key;
    expect(res.uploadUrl).toMatch(/X-Amz-Signature=[0-9a-f]{64}/);
    const row = await admin.query(`SELECT scan_status, tenant_id FROM media_assets WHERE id=$1`, [mediaId]);
    expect(row.rows[0].scan_status).toBe('pending');
    expect(row.rows[0].tenant_id).toBe(tenantA);

    await media.confirmUpload(tenantA, actor(user), mediaId, { bytes: 1000, sha256: sha } as any);
    await expect(media.getDownloadUrl(tenantA, actor(user), mediaId)).rejects.toBeInstanceOf(MediaNotScannedError);
  });

  it('a signed AV callback marks it clean → download returns a presigned URL', async () => {
    const { body, sig } = scan(s3Key, 'clean');
    await media.handleScanResult(body, sig);
    const dl = await media.getDownloadUrl(tenantA, actor(user), mediaId);
    expect(dl.url).toMatch(/X-Amz-Signature=[0-9a-f]{64}/);
    // a forged callback (bad signature) is rejected
    await expect(media.handleScanResult(JSON.stringify({ s3_key: s3Key, status: 'infected' }), 'deadbeef')).rejects.toBeTruthy();
  });

  it('an infected file stays blocked; a stranger gets 404 (IDOR-safe)', async () => {
    const r = await media.requestUpload(tenantA, user, { kind: 'image', mimeType: 'image/png', declaredBytes: 500 } as any);
    const { body, sig } = scan(r.s3Key, 'infected');
    await media.handleScanResult(body, sig);
    await expect(media.getDownloadUrl(tenantA, actor(user), r.mediaId)).rejects.toBeInstanceOf(MediaNotScannedError);
    await expect(media.getDownloadUrl(tenantA, actor(stranger), mediaId)).rejects.toBeInstanceOf(MediaNotFoundError);
  });

  it('RLS: tenant B cannot see tenant A\'s media asset', async () => {
    const countAs = async (t: string) => {
      const c = await inspect.connect();
      try { await c.query('BEGIN'); await c.query(`SELECT set_config('app.tenant_id',$1,true)`, [t]);
        const r = await c.query(`SELECT count(*)::int n FROM media_assets WHERE id=$1`, [mediaId]); await c.query('COMMIT'); return r.rows[0].n as number;
      } finally { c.release(); }
    };
    if (isSuperuser) { console.warn('[media] superuser bypasses RLS; use kv_app for the strict check'); expect(await countAs(tenantA)).toBe(1); return; }
    expect(await countAs(tenantA)).toBe(1);
    expect(await countAs(tenantB)).toBe(0);
  });
});
