# web-admin

The platform **god-mode** console. Next.js 14 (App Router), server-rendered. It talks to the **separate
`admin-api` security realm** (Law 11), NOT the tenant API — so it ships its own minimal `admin-client.ts` rather
than the tenant SDK. Never indexed; red brand signals the elevated realm.

## What it serves (built this slice)

- `/login` — links to the admin IdP (`/auth/sso/start`). Strong auth — **FIDO2 hardware key + recent step-up
  re-auth** — is performed by the IdP and **enforced by admin-api on every request**; no password in the UI.
- `/dashboard` — server-gated god-mode home (links to the live ops surfaces).
- `/ai-models` — the GLOBAL AI model registry (`GET /v1/ai/models`), keyset paging, status tinting.
- `/ai-models/[id]` — model fairness report (`GET /v1/ai/models/:id/fairness`): the stored monthly audit plus a
  fresh 30-day inference roll-up (total / overridden / low-confidence / override rate).
- `POST /api/session` — logout (clears the httpOnly admin cookie).

These hit the real, built `ai-models-ops` endpoints. Other nav items (Tenants, Feature Flags, Recon Monitor,
Audit Log) are shown as **"(soon)"** because their admin-api modules aren't built yet — they are not links.

## Security / correctness

- **Separate realm.** `admin-client.ts` attaches the admin bearer **server-side only**, bounds every call with a
  timeout, retries idempotent GETs, and maps non-2xx to a typed `AdminApiError` **without leaking the token**. A
  `403` surfaces as `needsElevation` (hardware-key / step-up / owner-perm not satisfied) — admin-api is the
  authority; this UI only reflects it.
- **Admin session cookie is httpOnly** (`admin-auth.ts`, `Secure` + `SameSite=Strict`) — unreadable to JS.
  `requireAdmin()` gates protected pages; the server re-enforces owner RBAC + elevation per call.
- **No secrets in the bundle** (`lib/env.ts`, single reader, fail-closed). **Never indexed** (`metadata.robots`
  + `robots.txt`). **Degrade, never die (Law 12):** failures render an inline notice, never a 500.

## Build note

The Next.js app + React compile under CI's `pnpm install`. New TSX is syntax-parsed clean offline with no broken
local imports. (The monorepo's `workspace:` deps can't be `npm install`ed in the sandbox.)

## Not yet built (planned route map)

tenants (+ detail), feature flags, recon monitor, audit log, moderation, AI review queue, providers (+ SLA),
plans, billing, platform reports, global catalogue/categories, schemes registry, min-wages, cells,
announcements, support tickets, compliance DSR queue, and tenant impersonation. Intentionally out of scope for
this vertical slice — nav never links to a route that doesn't exist, and no placeholder/TODO pages are shipped.
