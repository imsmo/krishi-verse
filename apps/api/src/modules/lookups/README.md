# lookups (reference-data reads · P1-9)

Public, read-only reference data so clients render pickers/facets with **real names**, never opaque UUIDs.

## Routes (all `@Public`, replica-backed, cached, bounded)
- `GET /v1/lookups/values?type=<code>` — a controlled vocabulary (e.g. `doc_type`, `cancel_reason`). Returns the
  platform values **plus the caller's tenant's own values**; a tenant value of the same `code` **shadows** the
  platform one (`DISTINCT ON (code)`). Locale-resolved name. `type` is a tight anchored identifier (ReDoS-safe).
- `GET /v1/lookups/regions[?parentId=&level=]` — admin regions: `level`-1 states by default, or a parent node's
  direct children. Locale-resolved name + centroid lat/lng.

## Name resolution (locale)
Both reads `LEFT JOIN translations` on `(entity_type, entity_id, field='name', language_code=baseLang(ctx.lang))`
and return `COALESCE(translation, default_name)` — the caller's-language label when a translation exists, else the
canonical default. `baseLang('hi-IN') → 'hi'` (pure, unit-tested). Unknown id → graceful fallback, never fabricated.

## Where the rest of the taxonomy lives (already public, pre-existing)
- Category tree → `GET /v1/categories` (catalogue). Attributes + options → `GET /v1/attributes[/options]`.
- Labour work-type/skill/region/skill-level → `GET /v1/labour/lookups`. KYC doc-types → `GET /v1/kyc/doc-types`.
The **SDK `lookups` resource** (`categories`/`attributesForCategory`/`attributeOptions`/`regions`/`values` +
`nameById`) consolidates the client-side reads across these endpoints.

## Boundaries
Read-only. Master-data **writes** are god-mode and live in `apps/admin-api` (Law 11). No money, no PII. Reads are
served from the replica (CQRS); the common state list + each vocabulary are cached with tenant-prefixed keys.
