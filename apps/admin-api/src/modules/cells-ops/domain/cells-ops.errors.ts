// apps/admin-api/src/modules/cells-ops/domain/cells-ops.errors.ts · typed errors → HTTP via HttpException
// subclasses with stable codes (mirrors the other ops modules). Covers the routing directory: cells, shards, and
// tenant placements. The routing guards fail CLOSED — a misroute would send a tenant's data to the wrong
// residency / wrong DB, so every guard throws rather than degrading.
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}

/* ---------------- not-found (404) ---------------- */
export class CellNotFoundError extends DomainHttpError {
  constructor(id: string) { super('CELL_NOT_FOUND', `cell '${id}' not found`, HttpStatus.NOT_FOUND, { id }); }
}
export class ShardNotFoundError extends DomainHttpError {
  constructor(id: string) { super('SHARD_NOT_FOUND', `shard '${id}' not found`, HttpStatus.NOT_FOUND, { id }); }
}
export class PlacementNotFoundError extends DomainHttpError {
  constructor(tenantId: string) { super('PLACEMENT_NOT_FOUND', `no placement for tenant '${tenantId}'`, HttpStatus.NOT_FOUND, { tenantId }); }
}

/* ---------------- validation (422) ---------------- */
export class InvalidCellsInputError extends DomainHttpError {
  constructor(detail: string) { super('CELLS_INPUT_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class IllegalNodeTransitionError extends DomainHttpError {
  constructor(from: string, to: string) { super('CELLS_ILLEGAL_TRANSITION', `illegal status transition ${from} → ${to}`, HttpStatus.UNPROCESSABLE_ENTITY, { from, to }); }
}
/** A tenant placed in country X may never be routed to a cell of another country (DPDP / data sovereignty). */
export class ResidencyViolationError extends DomainHttpError {
  constructor(from: string, to: string) { super('CELLS_RESIDENCY_VIOLATION', `cross-residency move blocked: ${from} → ${to}`, HttpStatus.UNPROCESSABLE_ENTITY, { from, to }); }
}

/* ---------------- conflict (409) ---------------- */
export class DuplicateCellCodeError extends DomainHttpError {
  constructor(code: string) { super('CELL_CODE_EXISTS', `cell code '${code}' already exists`, HttpStatus.CONFLICT, { code }); }
}
export class DuplicateShardIndexError extends DomainHttpError {
  constructor(cellId: string, shardIndex: number) { super('SHARD_INDEX_EXISTS', `shard_index ${shardIndex} already exists in cell '${cellId}'`, HttpStatus.CONFLICT, { cellId, shardIndex }); }
}
export class NodeNotAcceptingError extends DomainHttpError {
  constructor(kind: string, status: string) { super('CELLS_NODE_NOT_ACCEPTING', `${kind} is '${status}' and cannot accept placements`, HttpStatus.CONFLICT, { kind, status }); }
}
export class NodeNotEmptyError extends DomainHttpError {
  constructor(kind: string, placed: number) { super('CELLS_NODE_NOT_EMPTY', `${kind} still holds ${placed} placement(s); drain them before retiring`, HttpStatus.CONFLICT, { kind, placed }); }
}
export class CapacityExceededError extends DomainHttpError {
  constructor(kind: string, cap: number) { super('CELLS_CAPACITY_EXCEEDED', `${kind} is at its capacity of ${cap}`, HttpStatus.CONFLICT, { kind, cap }); }
}
export class AlreadyPlacedError extends DomainHttpError {
  constructor(tenantId: string) { super('TENANT_ALREADY_PLACED', `tenant '${tenantId}' already has a placement; use move`, HttpStatus.CONFLICT, { tenantId }); }
}
export class ShardCellMismatchError extends DomainHttpError {
  constructor() { super('SHARD_CELL_MISMATCH', 'the shard does not belong to the target cell', HttpStatus.UNPROCESSABLE_ENTITY); }
}
export class CellsAlreadyInStateError extends DomainHttpError {
  constructor(kind: string) { super('CELLS_ALREADY_IN_STATE', `${kind} is already in the requested state`, HttpStatus.CONFLICT, { kind }); }
}
