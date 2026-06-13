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

@Injectable()
export class PgIdempotencyService extends IdempotencyService {
  constructor(private readonly pools: PgPoolProvider) { super(); }

  async remember<T>(key: string, userId: string | undefined, endpoint: string, fn: () => Promise<T>): Promise<T> {
    const pool = this.pools.writer(0);
    const claim = await pool.query(
      `INSERT INTO idempotency_keys (key, user_id, endpoint)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [key, userId ?? null, endpoint],
    );

    if (claim.rowCount === 0) {
      const prior = await pool.query(
        `SELECT response_status, response_body FROM idempotency_keys WHERE key = $1`, [key]);
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
        [key, JSON.stringify(result ?? null)],
      );
      return result;
    } catch (err) {
      // release the claim so a real retry can proceed (do not cache failures)
      await pool.query(`DELETE FROM idempotency_keys WHERE key = $1 AND response_status IS NULL`, [key])
        .catch(() => undefined);
      throw err;
    }
  }
}
