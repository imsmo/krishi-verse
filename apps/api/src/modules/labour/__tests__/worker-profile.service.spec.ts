// modules/labour/__tests__/worker-profile.service.spec.ts · WorkerProfileService unit tests with fakes.
// Pins the one-profile-per-user guard (Law: user_id UNIQUE), the tx/outbox wiring (events drained in-tx,
// Law 4), and ownership on edit (only the worker may edit — authz THROWS, Law 6). Real RLS/SQL is the
// integration + tenant-isolation specs' job.
import { WorkerProfileService } from '../services/worker-profile.service';
import { WorkerProfile } from '../domain/worker-profile.entity';
import { WorkerAlreadyRegisteredError, LabourForbiddenError } from '../domain/labour.errors';

function harness(existing: WorkerProfile | null) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const repo = {
    findByUser: jest.fn(async () => existing),
    insert: jest.fn(async () => undefined),
    getForUpdate: jest.fn(async () => existing),
    update: jest.fn(async () => undefined),
  };
  const svc = new WorkerProfileService(uow as any, outbox as any, idem as any, metrics as any, repo as any);
  return { svc, outbox, repo };
}

describe('WorkerProfileService.register', () => {
  it('creates a profile + drains the registered event to the outbox in-tx', async () => {
    const { svc, outbox, repo } = harness(null);
    const out = await svc.register('t1', 'u1', 'idem-1', {} as any);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(out.userId).toBe('u1'); expect(out.ageVerified18).toBe(false);
    expect(outbox.write).toHaveBeenCalledTimes(1);
    expect(outbox.write.mock.calls[0][1].eventType).toBe('labour.worker_registered');
  });
  it('rejects a second profile for the same user (one-profile guard)', async () => {
    const existing = WorkerProfile.register({ id: 'w1', userId: 'u1', tenantId: 't1', onboardedBy: 'u1' });
    const { svc } = harness(existing);
    await expect(svc.register('t1', 'u1', 'idem-2', {} as any)).rejects.toBeInstanceOf(WorkerAlreadyRegisteredError);
  });
});

describe('WorkerProfileService.updateMine', () => {
  it('forbids editing another user\'s profile', async () => {
    const other = WorkerProfile.register({ id: 'w1', userId: 'someone_else', tenantId: 't1', onboardedBy: 'x' });
    const { svc } = harness(other);
    await expect(svc.updateMine('t1', 'u1', 'w1', { travelKm: 5 } as any)).rejects.toBeInstanceOf(LabourForbiddenError);
  });
});
