# Audit-trail viewer (`audit`) — read-only auditor surface

A strictly **read-only** window onto the append-only `audit_log` for a tenant's **auditor / accountant** role
(PRD §7 auditor surface). The trail itself is written **only** by `core/audit` `AuditWriter`, inside business
transactions — this module never writes, never updates, never deletes (the DB role grants forbid mutation of
`audit_log` anyway).

## Routes (`/v1/audit/entries`)
- `GET /v1/audit/entries` — browse, filtered by `action` / `entityType` / `entityId` / `actorUserId` / `from` / `to`,
  keyset-paginated (`created_at DESC, id DESC`); `meta.nextCursor` is an opaque base64 of `created_at|id`.
- `GET /v1/audit/entries/:id` — a single entry (404 if absent / not this tenant's).

## Guards (fail-closed)
- `@FeatureFlag('audit_trail')` — **OFF by default** (seed `db/seeds/core/0009_feature_flags.sql`); a disabled
  feature is invisible (404), never "exists but forbidden".
- `@RequirePermissions('audit.read')` — granted to `auditor` and `tenant_admin`
  (`db/seeds/core/0004_roles_permissions.sql`).

## Isolation (Law 12 + RLS)
Reads run on the tenant's shard **replica** inside a `BEGIN READ ONLY` tx that sets `app.tenant_id`, so the
`tenant_isolation` RLS policy on `audit_log` (auto-applied by migration `0014`, since the table carries
`tenant_id`) guarantees a tenant can only ever read its **own** audit rows. No new migration — this rides the
existing `audit_log` table + its RLS.

## Projection (no incidental PII)
The read projects `id, actor_user_id, actor_role, action, entity_type, entity_id, old_value, new_value, reason,
request_id, created_at`. `ip` and `user_agent` are deliberately **not** projected — they are operational metadata,
not part of the tenant-facing trail. `id` is a `bigint` → exposed as a string (bigint-safe).

## Scope / deferred
This build is browse + detail. **Deferred (flagged follow-on):** CSV/PDF export of a filtered range (a media
pipeline job) and saved auditor "views".
