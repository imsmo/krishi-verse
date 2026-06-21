# announcements (admin-api · god-mode plane, Law 11)

The platform-wide **announcements** module — banners / notices shown across tenant panels & apps (maintenance
windows, incident notices, product news). Distinct from cms `banners` (0012, tenant-scoped marketing): these are
authored once, centrally, by platform comms staff. A light CRUD + schedule module: plain-text content, a
draft→scheduled→published→expired/archived lifecycle, audience targeting, fully audited.

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/announcements` · `/announcements/:id` | `announcements.read` | — (keyset list + detail) |
| GET | `/v1/announcements/active` | `announcements.read` | — (currently-live preview) |
| GET | `/v1/announcements/:id/history` | `announcements.read` | — (change timeline, keyset) |
| POST | `/v1/announcements` | `announcements.manage` | **FIDO2 + step-up** (create draft) |
| PATCH | `/v1/announcements/:id` | `announcements.manage` | **FIDO2 + step-up** (edit — draft/scheduled only) |
| POST | `/v1/announcements/:id/schedule` | `announcements.manage` | **FIDO2 + step-up** (set window → scheduled) |
| POST | `/v1/announcements/:id/publish` | `announcements.manage` | **FIDO2 + step-up** (go live) |
| POST | `/v1/announcements/:id/expire` · `/archive` | `announcements.manage` | **FIDO2 + step-up** |

## What it owns
- **platform_announcements** (0040): title/body (PLAIN TEXT), `severity` (info/warning/critical), `placement`
  (banner/modal/toast), an `audience` blob (`{plans,countries}`; empty = everyone), an optional schedule window
  (`starts_at`/`ends_at`), `published_at`, and the lifecycle `status` (Law 5 state machine). Content + schedule are
  editable only while draft/scheduled; a published notice is immutable (expire/archive + recreate).
- **Live read** (`/active`): the currently-shown set (status='published' AND now within `[starts_at, ends_at)`),
  severity-first — the same predicate the apps/api banner read path uses (flagged integration note below).
- **Change history** (`announcement_changes`, 0040): append-only created/updated/scheduled/published/expired/
  archived with old→new + reason + actor.

## apps/api integration note (read path — flagged, not built here)
This module is the WRITER. The apps/api (tenant/app) read path surfaces live announcements by querying
`platform_announcements WHERE status='published' AND now() ∈ [starts_at, ends_at) AND audience matches the
caller's plan/country` (matching `repo.listActive` here) — a future apps/api read, like the flags evaluator.
admin-api only authors + previews.

## Threats considered (§4 + Law 11)
- **No stored XSS.** Title/body are PLAIN TEXT — `assertPlainText` rejects `<`/`>` (no HTML) and control chars, so
  a notice can never carry markup a downstream renderer might execute. Length-bounded (title ≤ 200, body ≤ 4000).
- **No privilege escalation (Law 11).** `announcements.manage`/`announcements.read` are PLATFORM owner perms (roles
  `platform_announcements_ops`/`platform_announcements_viewer`); never `*`, never money/god, never tenant-assignable
  (unit-tested). A platform-wide notice hits every tenant, so every mutation is `manage` + FIDO2 + step-up.
- **Audit.** Every change commits an `announcement_changes` row + an `audit_log` row IN THE SAME TX (actor, old→new,
  reason, ip, request_id); an illegal transition / immutable edit / invalid window writes nothing. Reads are
  access-logged by the @Global interceptor.
- **Fail closed / bounded.** Unknown announcement → 404; schedule windows must be forward, end in the future, and
  ≤365 days (no forever-banner); audience arrays charset-validated + size-capped; zod `.strict()` rejects unknown
  keys; keyset pagination (never OFFSET), max LIMIT 100; mandatory reason on every mutation. Global/god-mode table
  (no tenant_id) → kv_admin-only.

## Tests
- Unit (`announcements.spec.ts`): lifecycle state machine; entity (schedule/publish/expire/archive + edit-while-
  draft immutability + publish-now window rules); plain-text sanitisation (HTML/control-char rejection); audience
  bounds; window validation; owner-RBAC + no-escalation/no-`*`; DTO validation; service audit-in-tx + immutable
  guard + 404.
- Integration (`announcements.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): create→schedule
  →publish→expire — asserting `platform_announcements` state + window, that `/active` surfaces it only while
  published-in-window, the `announcement_changes` timeline, and the `audit_log` rows.
