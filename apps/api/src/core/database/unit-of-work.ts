// core/database/unit-of-work.ts
// Transaction runner bound to a TENANT'S SHARD. Sets app.tenant_id + app.user_id
// for RLS on the connection, runs the callback in a single ACID transaction,
// and (critically) the OutboxWriter shares this same tx so events can never be
// lost or dual-written (Law 4). Retries on serialization failures.
export interface SqlExecutor {
  query<T = any>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}
export interface TxContext extends SqlExecutor { readonly tenantId: string; readonly userId?: string; }

export abstract class UnitOfWork {
  /** Run fn in one tx on the tenant's shard with RLS set. Auto-retry on 40001/40P01. */
  abstract run<T>(tenantId: string, fn: (tx: TxContext) => Promise<T>, opts?: { userId?: string; retries?: number }): Promise<T>;
}
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
