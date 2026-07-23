// core/idempotency/idempotency.service.pg.ts
// Concrete IdempotencyService (Law 3). Village 2G networks retry constantly; a
// retried mutation must return the ORIGINAL result, never act twice.
//   • first caller: claims the key (INSERT … ON CONFLICT DO NOTHING), runs fn,
//     stores the response, returns it.
//   • retry after success: returns the stored response (no side effects).
//   • retry while the first is still in flight: 409 (client retries shortly).
//   • if fn throws: the claim is released so a genuine retry can succeed.
// Records live in the global idempotency_keys table (shard 0), separate from the
// business tx, so the claim survives a business rollback.
import { Injectable } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { PgPoolProvider } from '../database/pg-pool.provider';
import { ConflictError } from '../../shared/errors/app-error';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PgIdempotencyService extends IdempotencyService {
  constructor(private readonly pools: PgPoolProvider) { super(); }

  async remember<T>(key: string, userId: string | undefined, endpoint: string, fn: () => Promise<T>): Promise<T> {
    const pool = this.pools.writer(0);
    // SECURITY: scope the dedup key by caller + endpoint so one user can NEVER replay
    // another user's idempotency key (which would otherwise return their cached response).
    const scoped = `${userId ?? 'anon'}::${endpoint}::${key}`;
    // The user_id COLUMN is uuid; unauthenticated system callers (payment/payout
    // webhooks) pass the sentinel 'system', which is not a uuid. The dedup key above
    // already carries caller identity for scoping, so the column is informational —
    // store a real uuid or NULL, never a non-uuid string (else Postgres 22P02).
    const userIdCol = userId && UUID_RE.test(userId) ? userId : null;
    const claim = await pool.query(
      `INSERT INTO idempotency_keys (key, user_id, endpoint)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [scoped, userIdCol, endpoint],
    );

    if (claim.rowCount === 0) {
      const prior = await pool.query(
        `SELECT response_status, response_body FROM idempotency_keys WHERE key = $1`, [scoped]);
      if (prior.rowCount && prior.rows[0].response_status != null) {
        return prior.rows[0].response_body as T;            // replay the stored result
      }
      throw new ConflictError('Duplicate request still in progress; retry shortly',
        { idempotencyKey: key });
    }

    try {
      const result = await fn();
      await pool.query(
        `UPDATE idempotency_keys SET response_status = 200, response_body = $2::jsonb WHERE key = $1`,
        [scoped, JSON.stringify(result ?? null)],
      );
      return result;
    } catch (err) {
      // release the claim so a real retry can proceed (do not cache failures)
      await pool.query(`DELETE FROM idempotency_keys WHERE key = $1 AND response_status IS NULL`, [scoped])
        .catch(() => undefined);
      throw err;
    }
  }
}
