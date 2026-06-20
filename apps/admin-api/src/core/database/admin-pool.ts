// apps/admin-api/src/core/database/admin-pool.ts · the dedicated pg pool for the god-mode realm.
// Connects as kv_admin (RLS-bypass capable — admin-api operates platform-wide; every query is audited). The
// ONLY place a Pool is created in admin-api. withTx() runs a callback in ONE ACID transaction (Law 4 — the
// business write + its audit row commit atomically).
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AdminConfig } from '../config/admin-config';

@Injectable()
export class AdminPool implements OnModuleDestroy {
  private readonly pool: Pool;
  constructor(config: AdminConfig) {
    this.pool = new Pool({ connectionString: config.env.DATABASE_ADMIN_URL, max: config.env.DATABASE_POOL_MAX, application_name: 'kv-admin-api' });
  }
  query(text: string, params?: unknown[]) { return this.pool.query(text, params as any[]); }

  /** Run fn in a single transaction; commit on success, rollback on throw. */
  async withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* connection already broken */ }
      throw e;
    } finally {
      client.release();
    }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
