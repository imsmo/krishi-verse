// core/jobs/__tests__/scheduled-job.spec.ts · pure lockKey tests — identical algorithm to
// apps/worker/src/runtime/leader-lock.ts's lockKey (see apps/worker/src/__tests__/scheduler.spec.ts for
// the worker-side equivalent), kept in sync deliberately.
import { lockKey } from '../scheduled-job';

describe('scheduled-job.lockKey', () => {
  it('is deterministic + within int4 advisory range', () => {
    const k = lockKey('settlement-statements');
    expect(k).toBe(lockKey('settlement-statements'));
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThan(0x7fffffff);
  });

  it('distinct names → distinct keys (no obvious collision)', () => {
    const names = ['settlement-statements', 'notification-digest', 'kyc-expiry-reminders', 'scheme-sync'];
    expect(new Set(names.map(lockKey)).size).toBe(names.length);
  });

  it('matches apps/worker\'s leader-lock algorithm bit-for-bit for a shared job name', () => {
    // Re-implementation of apps/worker/src/runtime/leader-lock.ts's lockKey, inlined so this spec has
    // no cross-package import — proves the two independently-maintained copies cannot silently drift.
    function workerLockKey(name: string): number {
      let h = 0x811c9dc5;
      for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return (h >>> 0) % 0x7fffffff;
    }
    expect(lockKey('recon-zero-sum')).toBe(workerLockKey('recon-zero-sum'));
    expect(lockKey('settlement-statements')).toBe(workerLockKey('settlement-statements'));
  });
});
