// core/audit/audit.writer.ts
// Append-only audit trail (Definition of Done: "audit_log entries for admin actions").
// Writes to the immutable, partitioned audit_log. Two modes:
//  • write(tx, …)  — inside the business transaction, so the action and its audit
//    record commit atomically (the preferred path for state changes);
//  • log(…)        — its own connection, for read-side/sensitive-access auditing
//    (e.g. impersonation, data export view) where there is no business tx.
// Audit rows are NEVER updated/deleted (the DB role grants forbid it).
import { Injectable } from '@nestjs/common';
import { PgPoolProvider } from '../database/pg-pool.provider';
import { TxContext } from '../database/unit-of-work';

export interface AuditEntry {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;                 // e.g. 'user.role_assigned','kyc.approved','user.impersonated'
  entityType?: string | null;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const COLS = `(tenant_id, actor_user_id, actor_role, action, entity_type, entity_id,
  old_value, new_value, reason, ip, user_agent, request_id)`;
const VALS = `($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12)`;
const params = (e: AuditEntry) => [
  e.tenantId ?? null, e.actorUserId ?? null, e.actorRole ?? null, e.action,
  e.entityType ?? null, e.entityId ?? null,
  e.oldValue != null ? JSON.stringify(e.oldValue) : null,
  e.newValue != null ? JSON.stringify(e.newValue) : null,
  e.reason ?? null, e.ip ?? null, e.userAgent ?? null, e.requestId ?? null,
];

@Injectable()
export class AuditWriter {
  constructor(private readonly pools: PgPoolProvider) {}

  /** Audit within the caller's transaction (atomic with the business change). */
  async write(tx: TxContext, entry: AuditEntry): Promise<void> {
    await tx.query(`INSERT INTO audit_log ${COLS} VALUES ${VALS}`, params(entry));
  }

  /** Standalone audit (no business tx) — e.g. read/impersonation events. */
  async log(entry: AuditEntry): Promise<void> {
    await this.pools.writer(0).query(`INSERT INTO audit_log ${COLS} VALUES ${VALS}`, params(entry));
  }
}
export const AUDIT_WRITER = Symbol('AUDIT_WRITER');
