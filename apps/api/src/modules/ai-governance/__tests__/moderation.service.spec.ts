// modules/ai-governance/__tests__/moderation.service.spec.ts · moderation workflow unit tests with fakes.
// Pins: any user files (no perm); first OPEN report emits ModerationFiled, duplicates are silent no-ops;
// handle requires content.moderate + transitions + audits + emits.
import { ModerationService } from '../services/moderation.service';
import { AiGovernancePublisher } from '../events/ai-governance.publisher';
import { ModerationReport } from '../domain/moderation-report.entity';
import { ModerationReportNotFoundError, InvalidModerationError, AiForbiddenError } from '../domain/ai-governance.errors';

function report() {
  return ModerationReport.rehydrate({ id: 'rep1', tenantId: 't1', reporterUserId: 'u1', subjectType: 'listing', subjectId: 's1', reasonId: 'reason1', details: null, status: 'open', actionTaken: null, handledBy: null, handledAt: null });
}
function harness(opts: { reasonId?: string | null; inserted?: boolean; openBefore?: number; report?: ModerationReport | null } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const audit = { write: jest.fn() };
  const reports = {
    resolveReasonId: jest.fn(async () => (opts.reasonId === undefined ? 'reason1' : opts.reasonId)),
    countOpenForSubject: jest.fn(async () => opts.openBefore ?? 0),
    insertDeduped: jest.fn(async () => opts.inserted ?? true),
    getForUpdate: jest.fn(async () => (opts.report === undefined ? report() : opts.report)),
    getById: jest.fn(async () => opts.report ?? null), update: jest.fn(), listFor: jest.fn(),
  };
  const svc = new ModerationService(uow as any, new AiGovernancePublisher(outbox as any), metrics as any, audit as any, reports as any);
  return { svc, outbox, audit, reports };
}
const user = { userId: 'u1', canReview: false, canModerate: false };
const moderator = { userId: 'mod1', canReview: false, canModerate: true };
const fileDto = { subjectType: 'listing', subjectId: '11111111-1111-1111-1111-111111111111', reasonCode: 'spam', details: null } as any;

describe('file', () => {
  it('unknown reason → 422', async () => {
    await expect(harness({ reasonId: null }).svc.file('t1', user, fileDto)).rejects.toBeInstanceOf(InvalidModerationError);
  });
  it('first open report emits ModerationFiled', async () => {
    const h = harness({ openBefore: 0 });
    await h.svc.file('t1', user, fileDto);
    expect(h.outbox.write.mock.calls.some((c) => c[1].eventType === 'ai.moderation_filed')).toBe(true);
  });
  it('a duplicate (dedup no-op) returns deduped + emits nothing', async () => {
    const h = harness({ inserted: false });
    const out: any = await h.svc.file('t1', user, fileDto);
    expect(out.deduped).toBe(true);
    expect(h.outbox.write).not.toHaveBeenCalled();
  });
  it('not the first open report → no duplicate notification', async () => {
    const h = harness({ openBefore: 2 });
    await h.svc.file('t1', user, fileDto);
    expect(h.outbox.write).not.toHaveBeenCalled();
  });
});

describe('handle', () => {
  it('requires content.moderate', async () => {
    await expect(harness().svc.handle('t1', user, 'rep1', { status: 'actioned', action: 'removed' } as any, null)).rejects.toBeInstanceOf(AiForbiddenError);
  });
  it('actions a report + audits + emits', async () => {
    const h = harness();
    const out: any = await h.svc.handle('t1', moderator, 'rep1', { status: 'actioned', action: 'removed', note: 'spam' } as any, '1.2.3.4');
    expect(out.status).toBe('actioned');
    expect(h.audit.write).toHaveBeenCalledTimes(1);
    expect(h.outbox.write.mock.calls.some((c) => c[1].eventType === 'ai.moderation_actioned')).toBe(true);
  });
  it('missing report → 404', async () => {
    await expect(harness({ report: null }).svc.handle('t1', moderator, 'nope', { status: 'dismissed' } as any, null)).rejects.toBeInstanceOf(ModerationReportNotFoundError);
  });
});
