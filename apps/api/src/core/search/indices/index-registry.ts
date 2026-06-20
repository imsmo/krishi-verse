// core/search/indices/index-registry.ts · the catalogue of all searchable indices + lookups the index-builder
// and the outbox handler use: by logical name (ensure/reindex), and by outbox eventType (route an event to the
// index it affects). Adding a new searchable entity = add its IndexDef here; the builder, handler, and reindex
// job pick it up generically (no per-index code).
import { IndexDef } from './index-def';
import { LISTINGS_INDEX } from './listings.index';
import { PRODUCTS_INDEX } from './products.index';

export const ALL_INDICES: ReadonlyArray<IndexDef> = Object.freeze([LISTINGS_INDEX, PRODUCTS_INDEX]);

const BY_LOGICAL = new Map<string, IndexDef>(ALL_INDICES.map((d) => [d.logical, d]));
export function indexByLogical(logical: string): IndexDef | undefined { return BY_LOGICAL.get(logical); }

// eventType → the index defs that react to it (usually one, but the map allows fan-out).
const BY_EVENT = new Map<string, IndexDef[]>();
for (const def of ALL_INDICES) for (const et of def.eventTypes) {
  const arr = BY_EVENT.get(et) ?? []; arr.push(def); BY_EVENT.set(et, arr);
}
export function indicesForEvent(eventType: string): IndexDef[] { return BY_EVENT.get(eventType) ?? []; }
export const ALL_INDEXED_EVENT_TYPES: ReadonlyArray<string> = Object.freeze([...BY_EVENT.keys()]);
