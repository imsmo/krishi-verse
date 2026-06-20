// modules/ai-governance/__tests__/tenant-isolation.spec.ts · scoping SQL contract (CI gate).
// ai_inferences / ai_review_queue / moderation_reports bind tenant_id on every query; claim/handle lock the row
// FOR UPDATE (no version column); lists are KEYSET (no OFFSET); the moderation insert dedups via ON CONFLICT
// (abuse guard). ai_models is GLOBAL (no tenant_id) — read via the caller's shard replica.
import { AiInferenceRepository } from '../repositories/ai-inference.repository';
import { AiReviewRepository } from '../repositories/ai-review.repository';
import { ModerationReportRepository } from '../repositories/moderation-report.repository';
import { AiReview } from '../domain/ai-review.entity';
import { ModerationReport } from '../domain/moderation-report.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('ai_inferences isolation', () => {
  it('insert + reads bind tenant_id; tenant timeline keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ id: '1', created_at: new Date() }], rowCount: 1 }) };
    const { provider, exec } = fakeReplica();
    const repo = new AiInferenceRepository(provider);
    await repo.getById('tenantA', '1');
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$2/);
    await new AiInferenceRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', '1', new Date());
    expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const r2 = fakeReplica();
    await new AiInferenceRepository(r2.provider).listFor('tenantA', { limit: 50 });
    expect(r2.exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1/);
    expect(r2.exec.query.mock.calls[0][0]).toMatch(/ORDER BY created_at DESC, id DESC/);
    expect(r2.exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('ai_review_queue isolation', () => {
  const review = () => AiReview.rehydrate({ id: 'r1', tenantId: 'tenantA', inferenceId: '1', inferenceCreatedAt: new Date(), queueKind: 'manual', priority: 100, status: 'pending', reviewerUserId: null, decisionNote: null, resolvedAt: null });
  it('getForUpdate binds tenant_id + FOR UPDATE; list keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new AiReviewRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'r1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/);
    expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const { provider, exec } = fakeReplica();
    await new AiReviewRepository(provider).listFor('tenantA', { box: 'open', limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1/);
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
  it('insert binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new AiReviewRepository(fakeReplica().provider).insert(tx as any, review());
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO ai_review_queue/);
    expect(tx.query.mock.calls[0][1]).toContain('tenantA');
  });
});

describe('moderation_reports isolation + abuse guard', () => {
  const rep = () => ModerationReport.file({ id: 'rep1', tenantId: 'tenantA', reporterUserId: 'u1', subjectType: 'listing', subjectId: 's1', reasonId: 'reason1', details: null });
  it('insert dedups via ON CONFLICT (one report per reporter+subject)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new ModerationReportRepository(fakeReplica().provider).insertDeduped(tx as any, rep());
    expect(tx.query.mock.calls[0][0]).toMatch(/ON CONFLICT/);
    expect(tx.query.mock.calls[0][1]).toContain('tenantA');
  });
  it('getForUpdate binds tenant_id + FOR UPDATE; list keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new ModerationReportRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'rep1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/);
    expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const { provider, exec } = fakeReplica();
    await new ModerationReportRepository(provider).listFor('tenantA', { box: 'open', limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1/);
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});
