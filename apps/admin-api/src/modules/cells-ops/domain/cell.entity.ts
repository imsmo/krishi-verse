// apps/admin-api/src/modules/cells-ops/domain/cell.entity.ts · pure entity for a routing cell (an independent
// per-country stack; the DPDP residency boundary). No I/O. `code`/`country_code` are IMMUTABLE structural keys.
// status moves only through the node state machine (Law 5); meta edits + default/lock toggles throw on a no-op so
// audit records real changes only. Cells carry NO secret material.
import { NodeStatus, canTransition } from './node.state';
import { assertName, assertCapacity, assertNotes } from './routing';
import { IllegalNodeTransitionError, CellsAlreadyInStateError } from './cells-ops.errors';

export interface CellProps {
  id: string; code: string; displayName: string; countryCode: string; status: NodeStatus | string;
  isDefault: boolean; residencyLocked: boolean; capacityTenants: number | null; placedCount: number;
  notes: string | null; createdAt?: Date | null;
}
export type CellMetaPatch = { displayName?: string; capacityTenants?: number | null; residencyLocked?: boolean; notes?: string | null };

export class Cell {
  private constructor(private p: CellProps) {}
  static rehydrate(p: CellProps): Cell { return new Cell(p); }
  get id(): string { return this.p.id; }
  get code(): string { return this.p.code; }
  get countryCode(): string { return this.p.countryCode; }
  get status(): NodeStatus { return this.p.status as NodeStatus; }
  get isDefault(): boolean { return this.p.isDefault; }
  get residencyLocked(): boolean { return this.p.residencyLocked; }
  get capacityTenants(): number | null { return this.p.capacityTenants; }
  get placedCount(): number { return this.p.placedCount; }

  changeStatus(to: NodeStatus): { action: 'status_changed'; old: { status: string }; new: { status: string } } {
    const from = this.p.status as NodeStatus;
    if (from === to) throw new CellsAlreadyInStateError('cell');
    if (!canTransition(from, to)) throw new IllegalNodeTransitionError(from, to);
    this.p.status = to;
    return { action: 'status_changed', old: { status: from }, new: { status: to } };
  }

  updateMeta(patch: CellMetaPatch): { action: 'updated'; old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    if (patch.displayName !== undefined) { const v = assertName(patch.displayName); if (v !== this.p.displayName) { old.displayName = this.p.displayName; next.displayName = v; this.p.displayName = v; } }
    if (patch.capacityTenants !== undefined) { const v = assertCapacity(patch.capacityTenants); if (v !== this.p.capacityTenants) { old.capacityTenants = this.p.capacityTenants; next.capacityTenants = v; this.p.capacityTenants = v; } }
    if (patch.residencyLocked !== undefined && patch.residencyLocked !== this.p.residencyLocked) { old.residencyLocked = this.p.residencyLocked; next.residencyLocked = patch.residencyLocked; this.p.residencyLocked = patch.residencyLocked; }
    if (patch.notes !== undefined) { const v = assertNotes(patch.notes); if (v !== this.p.notes) { old.notes = this.p.notes; next.notes = v; this.p.notes = v; } }
    if (Object.keys(next).length === 0) throw new CellsAlreadyInStateError('cell');
    return { action: 'updated', old, new: next };
  }

  setDefault(to: boolean): { action: 'updated'; old: { isDefault: boolean }; new: { isDefault: boolean } } {
    if (this.p.isDefault === to) throw new CellsAlreadyInStateError('cell');
    const from = this.p.isDefault; this.p.isDefault = to;
    return { action: 'updated', old: { isDefault: from }, new: { isDefault: to } };
  }

  get persist() {
    return { displayName: this.p.displayName, status: this.p.status, isDefault: this.p.isDefault, residencyLocked: this.p.residencyLocked, capacityTenants: this.p.capacityTenants, notes: this.p.notes };
  }
  toJSON() {
    return { id: this.p.id, code: this.p.code, displayName: this.p.displayName, countryCode: this.p.countryCode, status: this.p.status, isDefault: this.p.isDefault, residencyLocked: this.p.residencyLocked, capacityTenants: this.p.capacityTenants, placedCount: this.p.placedCount, notes: this.p.notes, createdAt: this.p.createdAt ?? null };
  }
}
