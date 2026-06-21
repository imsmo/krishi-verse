// apps/admin-api/src/modules/cells-ops/domain/shard.entity.ts · pure entity for a physical shard within a cell
// (what the tenant→shard hash maps to). No I/O. `cell_id`/`shard_index` are IMMUTABLE structural keys. status
// moves only through the node state machine (Law 5). CRITICAL (§4): `dsn_secret_ref` is a VAULT ref to the
// connection string — it may be SET but is NEVER emitted (toJSON exposes only a `hasDsn` boolean), so the raw DSN
// never leaks in a response or log.
import { NodeStatus, canTransition } from './node.state';
import { assertWeight, assertNotes } from './routing';
import { IllegalNodeTransitionError, CellsAlreadyInStateError, InvalidCellsInputError } from './cells-ops.errors';

export interface ShardProps {
  id: string; cellId: string; shardIndex: number; status: NodeStatus | string; weight: number;
  placedCount: number; dsnSecretRef: string | null; notes: string | null; createdAt?: Date | null;
}
export type ShardMetaPatch = { weight?: number; notes?: string | null; dsnSecretRef?: string | null };

const DSN_REF_RE = /^[A-Za-z0-9:_\-/.]{1,200}$/;   // a vault path/ARN, NOT a connection string

export class Shard {
  private constructor(private p: ShardProps) {}
  static rehydrate(p: ShardProps): Shard { return new Shard(p); }
  get id(): string { return this.p.id; }
  get cellId(): string { return this.p.cellId; }
  get shardIndex(): number { return this.p.shardIndex; }
  get status(): NodeStatus { return this.p.status as NodeStatus; }
  get placedCount(): number { return this.p.placedCount; }

  changeStatus(to: NodeStatus): { action: 'status_changed'; old: { status: string }; new: { status: string } } {
    const from = this.p.status as NodeStatus;
    if (from === to) throw new CellsAlreadyInStateError('shard');
    if (!canTransition(from, to)) throw new IllegalNodeTransitionError(from, to);
    this.p.status = to;
    return { action: 'status_changed', old: { status: from }, new: { status: to } };
  }

  updateMeta(patch: ShardMetaPatch): { action: 'updated'; old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    if (patch.weight !== undefined) { const v = assertWeight(patch.weight); if (v !== this.p.weight) { old.weight = this.p.weight; next.weight = v; this.p.weight = v; } }
    if (patch.notes !== undefined) { const v = assertNotes(patch.notes); if (v !== this.p.notes) { old.notes = this.p.notes; next.notes = v; this.p.notes = v; } }
    if (patch.dsnSecretRef !== undefined) {
      const v = patch.dsnSecretRef === null ? null : patch.dsnSecretRef.trim();
      if (v !== null && !DSN_REF_RE.test(v)) throw new InvalidCellsInputError('dsn_secret_ref must be a vault reference (path/ARN), not a raw connection string');
      if (v !== this.p.dsnSecretRef) { old.dsnSecretRef = this.p.dsnSecretRef === null ? null : '***'; next.dsnSecretRef = v === null ? null : '***'; this.p.dsnSecretRef = v; }   // masked in the change record
    }
    if (Object.keys(next).length === 0) throw new CellsAlreadyInStateError('shard');
    return { action: 'updated', old, new: next };
  }

  get persist() { return { status: this.p.status, weight: this.p.weight, dsnSecretRef: this.p.dsnSecretRef, notes: this.p.notes }; }
  /** NEVER includes dsn_secret_ref — only whether one is configured. */
  toJSON() {
    return { id: this.p.id, cellId: this.p.cellId, shardIndex: this.p.shardIndex, status: this.p.status, weight: this.p.weight, placedCount: this.p.placedCount, hasDsn: this.p.dsnSecretRef !== null, notes: this.p.notes, createdAt: this.p.createdAt ?? null };
  }
}
