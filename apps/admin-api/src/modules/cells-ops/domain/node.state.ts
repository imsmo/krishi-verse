// apps/admin-api/src/modules/cells-ops/domain/node.state.ts · the ONE place a routing-node (cell OR shard) status
// transitions live (Law 5). Cells and shards share an identical lifecycle:
//   active ──▶ readonly   (freeze writes for maintenance)        readonly ──▶ active   (resume)
//   active ──▶ draining   (begin migrating tenants off)          readonly ──▶ draining
//   draining ──▶ active   (abort the drain / resume)             draining ──▶ retired  (ONLY when empty — guarded)
//   retired = TERMINAL    (a retired node never routes again; re-add as a new node)
// `active` is the ONLY status that accepts new placements (routing fails CLOSED everywhere else).
export const NODE_STATUSES = ['active', 'draining', 'readonly', 'retired'] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

const TRANSITIONS: Readonly<Record<NodeStatus, readonly NodeStatus[]>> = Object.freeze({
  active: ['readonly', 'draining'],
  readonly: ['active', 'draining'],
  draining: ['active', 'retired'],
  retired: [],
});

export function canTransition(from: NodeStatus, to: NodeStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}
/** `active` is the only status that accepts a new/moved tenant placement (fail-closed routing). */
export function acceptsPlacement(status: NodeStatus): boolean { return status === 'active'; }
