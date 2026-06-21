// apps/admin-api/src/modules/global-catalogue-ops/domain/category-tree.ts · pure helpers for the 5-level category
// tree (0004). `code` is the materialised dotted path ('crops.cereals.wheat') and mirrors the ltree `path`; a
// node's leaf SLUG is the last label. Labels are restricted to ltree-safe lowercase `[a-z0-9_]` so code/path stay
// valid ltree. The hard invariants — depth 1..5, no cycles, bounded subtree moves — live here, framework-free.
import { InvalidCatalogueInputError, CategoryDepthExceededError, CategoryCycleError } from './catalogue.errors';
import { assertPlainText } from './text';

export const MAX_DEPTH = 5;                 // categories.depth CHECK (depth BETWEEN 1 AND 5)
export const MAX_CODE = 80;                 // categories.code varchar(80)
export const MAX_NAME = 150;                // categories.default_name varchar(150)
export const MAX_SUBTREE_MOVE = 1000;       // bound write-amplification of a reparent (one UPDATE rewrites the subtree)
export const MAX_MIN_AGE = 120;
export const COMMERCE_KINDS = ['goods', 'livestock', 'service', 'rental', 'course', 'input_regulated'] as const;
export type CommerceKind = (typeof COMMERCE_KINDS)[number];
// one ltree label: lowercase alnum + underscore, 1..40 chars (keeps code/path valid ltree, ReDoS-safe).
const SLUG_RE = /^[a-z0-9_]{1,40}$/;

export function assertSlug(slug: string): string {
  const v = slug.trim();
  if (!SLUG_RE.test(v)) throw new InvalidCatalogueInputError(`slug must match ^[a-z0-9_]{1,40}$ (got '${slug}')`);
  return v;
}
export function assertCategoryName(name: string): string { return assertPlainText(name, 'default_name', MAX_NAME); }

export function assertCommerceKind(k: string): CommerceKind {
  if (!(COMMERCE_KINDS as readonly string[]).includes(k)) throw new InvalidCatalogueInputError(`commerce_kind must be one of ${COMMERCE_KINDS.join('|')}`);
  return k as CommerceKind;
}
export function assertMinAge(n: number | null): number | null {
  if (n === null) return null;
  if (!Number.isInteger(n) || n < 0 || n > MAX_MIN_AGE) throw new InvalidCatalogueInputError(`min_age must be an integer in 0..${MAX_MIN_AGE} (or null)`);
  return n;
}

/** code = dotted path of the leaf under its parent (root => the slug itself). Bounded to the column width. */
export function deriveCode(parentCode: string | null, slug: string): string {
  const code = parentCode ? `${parentCode}.${slug}` : slug;
  if (code.length > MAX_CODE) throw new InvalidCatalogueInputError(`derived category code '${code}' exceeds ${MAX_CODE} chars`);
  return code;
}
/** depth = parent depth + 1 (root => 1); throws if it would exceed the 5-level limit. */
export function deriveDepth(parentDepth: number | null): number {
  const depth = (parentDepth ?? 0) + 1;
  if (depth > MAX_DEPTH) throw new CategoryDepthExceededError(MAX_DEPTH);
  return depth;
}
/** The leaf slug of a node = the last dotted label of its code/path. */
export function leafSlug(code: string): string { return code.slice(code.lastIndexOf('.') + 1); }

/** True iff `candidatePath` is the node itself or one of its descendants (used to reject a cyclic reparent). */
export function isSelfOrDescendant(candidatePath: string, nodePath: string): boolean {
  return candidatePath === nodePath || candidatePath.startsWith(`${nodePath}.`);
}
/** Guard a reparent against cycles: the new parent may not be the node or any node beneath it. */
export function assertNoCycle(newParentPath: string | null, nodePath: string): void {
  if (newParentPath !== null && isSelfOrDescendant(newParentPath, nodePath)) throw new CategoryCycleError();
}
/** After a move, the DEEPEST descendant's new depth (current max + delta) must still be within the limit. */
export function assertMovedDepthWithinLimit(subtreeMaxDepth: number, depthDelta: number): void {
  if (subtreeMaxDepth + depthDelta > MAX_DEPTH) throw new CategoryDepthExceededError(MAX_DEPTH);
}
