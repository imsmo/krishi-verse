// apps/worker/src/runtime/leader-lock.ts · single-runner guard across worker replicas via Postgres ADVISORY LOCKS.
// Each job name → stable 31-bit key; only the replica that wins pg_try_advisory_lock runs it this tick, so N
// workers are safe (no double retention purge / double recon). Pure key derivation is unit-tested.
export function lockKey(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 0x7fffffff; // 0 .. 2^31-1 (fits a signed int4 advisory key)
}

export interface LockClient { query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> }

export async function tryAdvisoryLock(client: LockClient, key: number): Promise<boolean> {
  const r = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [key]);
  return r.rows[0]?.ok === true;
}
export async function advisoryUnlock(client: LockClient, key: number): Promise<void> {
  await client.query('SELECT pg_advisory_unlock($1)', [key]);
}
