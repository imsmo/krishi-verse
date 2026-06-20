// apps/admin-api/src/modules/ai-models-ops/__tests__/ai-models-ops.integration.spec.ts
// REAL end-to-end proof against a live Postgres (the same schema apps/api builds). ai_models is GLOBAL (no
// tenant_id → no RLS to deny across tenants — that property is asserted in apps/api's ai-governance integration
// test for the tenant-scoped tables). Here we prove the god-mode WRITE path: register → read back → promote
// (state machine) → tune threshold, with an append-only audit_log row written per mutation, and the UNIQUE
// (code,version) guard. Runs only when DATABASE_URL is set.
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AdminConfig } from '../../../core/config/admin-config';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AiModelRepository } from '../repositories/ai-model.repository';
import { ModelRegistryService } from '../services/model-registry.service';
import { ThresholdTuningService } from '../services/threshold-tuning.service';
import { DuplicateAiModelError } from '../domain/ai-models.errors';

const APP_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
const run = APP_URL ? describe : describe.skip;

run('ai-models-ops (integration, real Postgres — god-mode model lifecycle + audit)', () => {
  let pool: AdminPool; let inspect: Pool;
  let registry: ModelRegistryService; let tuning: ThresholdTuningService;
  const actor = { userId: randomUUID(), roles: ['platform_ai_ops'], amr: ['hwk'], authTimeSec: Math.floor(Date.now() / 1000), sessionId: '', permissions: new Set(['ai.model.manage']), ip: '10.0.0.1', requestId: 'itest' } as any;
  const code = `itest_model_${randomUUID().slice(0, 8)}`;
  let modelId = '';

  beforeAll(async () => {
    const config = new AdminConfig({ NODE_ENV: 'test', DATABASE_ADMIN_URL: APP_URL, ADMIN_JWT_SECRET: 's'.repeat(40) });
    pool = new AdminPool(config);
    const audit = new AdminAuditWriter(pool);
    const repo = new AiModelRepository(pool);
    registry = new ModelRegistryService(pool, audit, repo);
    tuning = new ThresholdTuningService(pool, audit, repo);
    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);
  afterAll(async () => {
    if (inspect) { await inspect.query(`DELETE FROM ai_models WHERE code=$1`, [code]); await inspect.end(); }
    await pool?.onModuleDestroy();
  });

  it('registers a model (shadow) + writes an audit row', async () => {
    const out: any = await registry.register(actor, { code, version: 'v1', provider: 'inhouse', confidenceThreshold: 0.8 } as any);
    modelId = out.id;
    expect(out.status).toBe('shadow');
    const got: any = await registry.getById(modelId);
    expect(got.code).toBe(code);
    const audit = await inspect.query(`SELECT action FROM audit_log WHERE entity_id=$1 AND action='ai.model.registered'`, [modelId]);
    expect(audit.rows.length).toBe(1);
  });

  it('promotes shadow→canary→production (state machine) + audits each', async () => {
    await registry.promote(actor, modelId, { to: 'canary', reason: 'shadow looked good' } as any);
    const prod: any = await registry.promote(actor, modelId, { to: 'production', reason: 'canary stable' } as any);
    expect(prod.status).toBe('production');
    const n = await inspect.query(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id=$1 AND action='ai.model.promoted'`, [modelId]);
    expect(n.rows[0].c).toBe(2);
  });

  it('tunes the confidence threshold + audits old→new', async () => {
    const out: any = await tuning.tune(actor, modelId, { confidenceThreshold: 0.6, reason: 'reduce escalations' } as any);
    expect(out.confidenceThreshold).toBe(0.6);
    const row = await inspect.query(`SELECT confidence_threshold FROM ai_models WHERE id=$1`, [modelId]);
    expect(Number(row.rows[0].confidence_threshold)).toBeCloseTo(0.6, 4);
  });

  it('rejects a duplicate (code,version)', async () => {
    await expect(registry.register(actor, { code, version: 'v1', provider: 'inhouse', confidenceThreshold: 0.8 } as any)).rejects.toBeInstanceOf(DuplicateAiModelError);
  });
});
