# web-admin ✅

The platform **god-mode** console. Next.js 14 (App Router), server-rendered. It talks to the **separate
`admin-api` security realm** (Law 11), NOT the tenant API — so it ships its own minimal `admin-client.ts` rather
than the tenant SDK. Never indexed; red brand signals the elevated realm.

**Status: ✅ complete** (AD-W7-01 DoD closed). All 16 god-mode surfaces are live (Dashboard, AI Models +
promote/threshold, Tenants, Reports, Flags, Recon, Billing, Plans, Providers, Support, Compliance, Impersonation,
Announcements, Catalogue, Schemes-registry, Cells) on the typed admin-client. Every pure `features/**` module is
unit-tested; every page is `requireAdmin`-gated + triple-noindex (per-page metadata.robots + root layout +
`X-Robots-Tag`); root `loading`/`error`/`not-found` boundaries plus section-level loading cover every fetching
segment; the `403 → needsElevation` re-auth path is wired end-to-end; a11y shell (skip-link, `lang`, `main`
landmark, labelled nav) is in place; and the §4 self-audit is clean (no secrets/token-leak in the browser, no
stray `process.env`, no inline styles, no float coercion on money — `admin-client`/`admin-auth` are `server-only`).

## What it serves (built this slice)

- **Foundation (AD-W0-01).** Central **i18n catalog** (`src/i18n/en.ts` + a server `Translator` in `lib/i18n.ts`;
  en-primary — web-admin is an internal staff-only realm, so hi/gu parity is optional — but **no hardcoded
  literals**). A red-brand, **elevation-aware** `Sidebar` (`features/nav` model, unit-tested) that links **only to
  built routes**; not-yet-built surfaces render as non-link **"(soon)"** labels. Root `loading.tsx` / `error.tsx`
  (offers both **retry** and **re-authenticate**, since god-mode errors are often an expired/insufficient session)
  / `not-found.tsx` boundaries. A typed **mutation path** on `admin-client.ts` (`adminPost`/`adminPatch`/
  `adminPut`/`adminDelete`: server-only, the mandatory audit `reason` goes in the body, optional Idempotency-Key
  header, **no auto-retry**) ready for the write-bearing waves. `jest` + a pure unit test for the nav/notice model.
- `/login` — links to the admin IdP (`/auth/sso/start`). Strong auth — **FIDO2 hardware key + recent step-up
  re-auth** — is performed by the IdP and **enforced by admin-api on every request**; no password in the UI.
- `/dashboard` — server-gated god-mode home (links to the live ops surfaces).
- `/tenants` — the platform-wide tenant directory (`GET /v1/tenants`, keyset paging + status filter; reads across
  all tenants by design, Law 11) and `/tenants/[id]` — the per-tenant **scorecard** (`GET /v1/tenants/:id`: status,
  risk, current subscription with price via `formatMoneyMinor`, live-listing + open-dispute counts, active limit
  overrides). Lifecycle actions are surfaced **only when legal** for the current status (`features/tenants` mirrors
  the server state machine, unit-tested): **approve / suspend / archive** (`POST :id/approve|suspend|archive`,
  each carrying a mandatory audit **reason**) and **set a quota-limit override** (`PATCH :id/limits`; value is a
  float-free integer string, `-1` = unlimited). All are Server-Action forms; admin-api requires FIDO2 + step-up, so
  a `403` degrades to a re-auth notice and a `409` illegal transition to a reload message.
- `/reports` — cross-tenant exec dashboards (read-only, aggregate, audited): **overview**
  (`GET /v1/reports/overview` — MRR/ARR + active-subs/tenants/users + login-success), **GMV** (`gmv` — GMV /
  platform-fee / commission / orders / AOV) and **tenant-growth** (`tenant-growth` — new-tenants by month). Each
  panel fetches in parallel and **degrades independently**; money is rendered via `formatMoneyMinor` from
  minor-unit strings and the login-success ratio via a float-free integer-basis-points helper. A PII-free
  **regulator-export** download (`GET /v1/reports/regulator-export`) is served as a JSON attachment by a server
  Route Handler (bearer attached server-side only).
- `/flags` — global feature flags (Law 10): the registry (`GET /v1/flags`, prefix + enabled filter, keyset) + a
  **create** form (`POST` — defaults OFF / 0%), and `/flags/[key]` — the flag detail + change history
  (`GET :key` + `GET :key/history`). Actions are surfaced **only when legal** for the lock/enabled state
  (`features/flags` mirrors the server's kill-switch lock semantics): **enable / disable**, **set rollout %**
  (float-free integer 0–100), **set targeting** (tenant/plan/country allowlists), the emergency **kill-switch**,
  and **unlock** — each a Server-Action form carrying a mandatory audit reason. admin-api requires FIDO2 + step-up;
  a `403` degrades to a re-auth notice and a `409` (locked) to a message.
- `/recon` — the platform money-safety monitor: an **overview** (`GET /v1/recon/overview` — latest reconciliation
  run per type + the ledger **zero-sum health**, where `balanced=false` is an alarm), `/recon/runs` +
  `/recon/runs/[id]` (run detail + mismatch payload, with an **open-investigation** form `POST /recon/investigations`),
  `/recon/investigations` + `/recon/investigations/[id]` (the mismatch queue + **work actions** start / resolve /
  false-positive `PATCH :id`, surfaced only when legal — `features/recon` mirrors the server state machine), and
  `/recon/accounts/[id]` (wallet-account drill-down with the **freeze / unfreeze** control `POST :id/freeze`).
  Money is rendered via `formatMoneyMinor` from minor-unit strings; nothing here posts the ledger. Mutations carry
  a mandatory audit reason; admin-api requires FIDO2 + step-up, so a `403` degrades to a re-auth notice and a `409`
  to a reload message.
- `/billing` — platform SaaS billing: a **revenue overview** (`GET /v1/billing/revenue` — MRR/ARR + outstanding /
  collected + invoice status counts), `/billing/invoices` + `/billing/invoices/[id]` (invoice detail + dunning
  history, with **issue / mark-overdue / void** transitions surfaced only when legal — `features/billing` mirrors
  the invoice state machine — and a **record-dunning** form while collectible), and `/billing/adjustments`
  (adjustment ledger + a **post-adjustment** money move `POST /billing/adjustments`). Amounts are entered in
  **minor units** (whole numbers, float-free) and the adjustment Server Action attaches a fresh idempotency key so
  a double-submit never double-posts; money is rendered via `formatMoneyMinor`. Mutations carry a mandatory audit
  reason; admin-api requires FIDO2 + step-up, so a `403` degrades to a re-auth notice and a `409` to a message.
- `/plans` — the SaaS plan catalogue (`GET /v1/plans` + the feature catalogue `GET /v1/plans/features`) and
  `/plans/[id]` — plan detail + feature/limit composition + change history. **Create** a plan (`POST`), drive the
  **lifecycle** publish / archive / reactivate (`PATCH :id`, surfaced only when legal — `features/plans` mirrors
  the plan state machine), update **pricing** (`PATCH :id/pricing`), cut a **new version** (`POST :id/version`),
  and **set / clear features and limits** (`PUT|DELETE :id/features/:code`, `…/limits/:code`). Prices are entered
  in **minor units** (float-free) and rendered via `formatMoneyMinor`; a limit is a whole number or `-1`
  (unlimited). Mutations carry a mandatory audit reason; admin-api requires FIDO2 + step-up, so a `403` degrades to
  a re-auth notice and a `409` (e.g. version exists) to a message.
- `/schemes-registry` — the PLATFORM government-scheme master (a master edit ripples into every tenant's scheme
  catalogue + applications). Section nav over **authorities** (`/schemes-registry` — `GET authorities`, level
  filter + **create**; `/schemes-registry/authorities/[id]` detail + **edit** `PATCH :id` + history), **schemes**
  (`/schemes-registry/schemes` — `GET schemes`, active filter + **create** `POST schemes`;
  `/schemes-registry/schemes/[id]` detail with **edit-meta** `PATCH :id` (no version bump), **edit-rules** `POST
  :id/rules` (bumps version — snapshot integrity), **set-window** `POST :id/window`, **activate/deactivate** `POST
  :id/active`, and change history `:id/history`) and a read-only **window calendar** (`/schemes-registry/calendar`
  — `GET schemes/calendar`, active schemes open on a given MM-DD). The scheme `code` is immutable; benefit-summary
  and eligibility-rules are non-empty JSON objects; the application window is `{opens,closes,season?}` as MM-DD;
  the processing fee is a minor-unit digit string rendered via `formatMoneyMinor` (Law 2). Mutations carry a
  mandatory audit reason; admin-api requires `schemes.registry.manage` + FIDO2 + step-up, so a `403` degrades to a
  re-auth notice, a `409` (duplicate code / already in state) and `422` (invalid / non-active category) to messages.
- `/cells` — the PLATFORM CELL MAP: the per-country routing stacks that form each data-residency (DPDP) boundary,
  the physical shards inside them, and which tenant lives where. Section nav over **cells** (`/cells` —
  `GET /v1/cells/cells`, country + status filter + **create**; `/cells/cells/[id]` detail with **edit** `PATCH :id`
  [code/country are immutable], **status** `POST :id/status` over the node state machine [active↔readonly↔draining→retired],
  **make/unset default** `POST :id/default`, **residency-lock toggle** `POST :id/residency-lock`, and history), **shards**
  (`/cells/shards` — `GET shards`, cell + status filter + **create**; `/cells/shards/[id]` detail + **edit**
  `PATCH :id` [weight/notes] + **status** + history), **placements** (`/cells/placements` — `GET placements`,
  cell/shard filter + **place** `POST placements`; `/cells/placements/[tenantId]` detail + **move** `POST
  :tenantId/move` + **remove** `DELETE :tenantId`) and a read-only **residency report** (`/cells/residency` —
  `GET residency-report`, per-country DPDP posture with an at-risk flag). A shard's connection string is a vault
  `dsn_secret_ref` that admin-api never emits — the console only ever shows a `hasDsn` boolean and offers no field
  to set one. Unlocking residency or moving a tenant crosses a DPDP boundary, so both surface an explicit warning;
  admin-api enforces residency rules, shard↔cell match, capacity and node-accepting on the server. Mutations carry a
  mandatory audit reason; admin-api requires `cells.ops.manage` + FIDO2 + step-up, so a `403` degrades to a re-auth
  notice, `409` (duplicate code/index, node not accepting/empty, capacity, already placed) and `422`
  (invalid / illegal transition / residency violation / shard-cell mismatch) to clear messages.
- `/catalogue` — the PLATFORM master taxonomy (a change here ripples into every tenant's catalogue). Two
  registries under a section nav: **lookup vocabularies** (`/catalogue` — `GET /v1/catalogue/lookup-types`, keyset
  + **create**; `/catalogue/lookup-types/[code]` shows the type + its platform values `GET lookup-values?typeCode`
  with **rename** `PATCH :code` and **add-value** `POST lookup-values`; `/catalogue/lookup-values/[id]` is the
  value detail + **edit** `PATCH :id`, **activate/deactivate** `POST :id/active`, and change history `:id/history`)
  and the **category tree** (`/catalogue/categories` — `GET categories`, commerce-kind + active filter + **create**
  `POST categories`; `/catalogue/categories/[id]` shows the node + its children `:id/children`, with **edit**
  `PATCH :id`, **move/reparent** `POST :id/move` (cycle- and depth-checked server-side), **activate/deactivate**
  `POST :id/active`, and history `:id/history`). Codes/slugs are charset-bounded, `meta` is a flat JSON object,
  sortOrder/minAge are float-free integers; mutations carry a mandatory audit reason and admin-api requires
  `catalogue.manage` + FIDO2 + step-up, so a `403` degrades to a re-auth notice, a `409` (duplicate / already in
  state / inactive parent / active children) and `422` (invalid / depth / cycle) to clear messages.
- `/announcements` — platform-wide notices. The list (`GET /v1/announcements`, status + severity filter, keyset)
  with a **live-now** strip (`active`) and a **create** form (`POST` — starts a draft; plain-text only, HTML
  rejected; audience targeting by plan/country allowlists). `/announcements/[id]` (`:id`) shows the notice +
  change history (`:id/history`) with **edit** (`PATCH :id`, offered only while draft/scheduled — a published
  notice is immutable) and the lifecycle **schedule / publish / expire / archive** (`POST :id/*`) surfaced only
  when legal (`features/announcements` mirrors the server state machine). Schedule windows are ISO 8601 UTC.
  Mutations carry a mandatory audit reason; admin-api requires `announcements.manage` + FIDO2 + step-up, so a
  `403` degrades to a re-auth notice and a `409` (illegal/immutable) to a message.
- `/impersonation` — the god-mode **act-as** register (the highest-sensitivity surface; a prominent warning frames
  the page). The grant list (`GET /v1/impersonation/grants`, status filter, keyset) + a **mint** form (`POST
  grants` — **read-only** scope only, time-boxed 60–3600s, ≥8-char justification) and `/impersonation/grants/[id]`
  (`:id`) showing the grant + its **per-action audit trail** (`:id/actions` — every request the honouring API
  recorded under the grant). **End** (`:id/end`) and **revoke** (`:id/revoke`) are surfaced only while the grant is
  active (`features/impersonation` mirrors the server state machine). admin-api requires `impersonation.grant` +
  FIDO2 + step-up; `POST grants` returns the scoped act-as **token once** — the Server Action receives it
  server-side and **deliberately discards it** (it is never returned to the browser, serialised into props/HTML, or
  logged). A `403` distinguishes the kill-switch / privileged-target / step-up cases; a `409` (active grant exists)
  and `422` (self / scope / ttl) degrade to clear messages. `recordAction` is a machine-only endpoint and is not
  surfaced.
- `/compliance` — the god-mode DPDP/compliance plane (PII-minimal — only statuses, categories, UUIDs and counts;
  never raw subject data). The **DSR queue** (`GET /v1/compliance/dsr`, status + type filter, keyset) +
  `/compliance/dsr/[id]` (`:id`) where **start / complete / reject** (`PATCH dsr/:id`) are surfaced only when legal
  (`features/compliance` mirrors the dsr.state machine; an erasure can't complete inside its 90-day cooling window
  → admin-api 409). **Export approvals** (`/compliance/exports` — `GET exports`) with an inline **approve / reject**
  (`POST exports/:id/decision`) on each pending job. **Breaches** (`/compliance/breaches` — `GET breaches` + an
  **open-incident** form `POST breaches` recording data **categories only**) + `/compliance/breaches/[id]` (`:id`)
  with the **contain → notify → close** lifecycle (`PATCH :id`, surfaced only when legal; "notify" requires both
  the regulator- and principals-notified DPDP §8 timestamps). **Retention** (`/compliance/retention` — `GET
  retention` + an upsert `POST retention`, whole-month windows, float-free). A read-only **audit-log explorer**
  (`/compliance/audit` — `GET audit`, actor/entity/action/tenant/time filters via a GET form, partition-pruned
  keyset). Every mutation carries a mandatory audit justification; admin-api requires `compliance.manage` + FIDO2 +
  step-up, so a `403` degrades to a re-auth notice and a `409`/`422` to a clear message.
- `/providers` — the integration-provider registry (`GET /v1/providers`, category + active filter, keyset) with
  two finance-ops lenses: `/providers/health` (`GET /v1/providers/health` — every provider + credential-reference
  coverage; a provider that is **disabled while tenants still reference it** is flagged **degraded**, surfaced
  first) and `/providers/financial` (`financial` — the money-path providers only: payment gateways + KYC). This
  plane reports **persisted configuration health** (counts only — never secret material), not real-time latency.
  `/providers/[code]` is the provider detail + change history (`GET :code` + `:code/history`) with the one
  consequential write — **enable / disable** (`PATCH :code`, Law 12: pull a failing provider out of rotation
  platform-wide) — surfaced **only when it is a real change** (`features/providers` mirrors the server's no-op
  rejection; admin-api returns `409` otherwise) as a Server-Action form carrying a mandatory audit reason.
  admin-api requires `providers.manage` + FIDO2 + step-up, so a `403` degrades to a re-auth notice.
- `/support` — the cross-tenant support NOC: the ticket queue (`GET /v1/support/tickets`, tenant/status/severity/
  SLA-breach/assigned filters + keyset), `/support/sla-breaches` (`sla-breaches` — still-working tickets past an
  unsatisfied SLA due date, most-urgent first) and `/support/tenant-health` (`tenant-health` — top tenants by open
  SLA breaches: open / breached / P0-open counts + oldest-open age, float-free). `/support/tickets/[id]` is the
  ticket detail + computed SLA state with the one consequential write — **escalate** (`POST tickets/:id/escalate`:
  raise severity (raise-only — only higher-priority targets are offered), move to “escalated”, optionally reassign
  to a platform lead) — surfaced **only when the ticket is escalatable** (`features/support` mirrors the server
  state machine; a resolved/closed ticket can’t be escalated) as a Server-Action form carrying a mandatory audit
  reason. admin-api requires `support.oversight.manage` + FIDO2 + step-up, so a `403` degrades to a re-auth notice
  and a `422` (nothing-to-escalate / would-lower) to a message. Support is a helpdesk — no money path.
- `/ai-models` — the GLOBAL AI model registry (`GET /v1/ai/models`), keyset paging, status pills.
- `/ai-models/[id]` — model fairness report (`GET /v1/ai/models/:id/fairness`): the stored monthly audit plus a
  fresh 30-day inference roll-up (total / overridden / low-confidence / override rate), **plus the two
  consequential lifecycle mutations** (AD-W6-04): **promote/demote** (`POST :id/promote` — the promote `<select>`
  offers ONLY the model state machine's legal next states shadow→canary→production→retired) and **tune confidence
  threshold** (`PATCH :id/threshold` — a 0–1 ratio that gates which inferences go to human review; blank clears
  it). Both are Server-Action forms carrying a mandatory audit reason; admin-api re-checks `ai.model.manage` +
  FIDO2 + step-up, so a `403` degrades to a re-auth notice, `409`/`422` (illegal transition / bad input) to clear
  messages. The threshold + the roll-up's override rate are 0–1 ratios (not money) rendered via the feature
  module's float-free integer-math formatters.
- `POST /api/session` — logout (clears the httpOnly admin cookie).

With AD-W6-03 landing `/cells`, every nav surface (Dashboard, AI Models, Tenants, Reports, Flags, Recon, Billing,
Plans, Providers, Support, Compliance, Impersonation, Announcements, Catalogue, Schemes, Cells) is now **live** —
the `liveNav`/`soonNav` partition has no remaining "(soon)" entries, and the nav never links to a route that
doesn't exist. The per-wave plan lives in `ADMIN_BUILD_BACKLOG.md`; remaining work is the AD-W7-01 polish/DoD sweep.

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
local imports. (The monorepo's `workspace:` deps can't be `npm install`ed in the sandbox.) The app's **pure**
logic (`features/nav/nav-model.ts` — the elevation-aware nav model + admin-api `status → notice` mapping) is
unit-tested under `jest` + `ts-jest` (`src/test/nav-model.spec.ts`, `npm test`). The always-on gate in the sandbox
is the static §4 self-audit (no hardcoded literals, no token in any client bundle, no stray `process.env`, no
inline styles); `tsc --noEmit` + `next lint` + `next build` run in CI's pnpm toolchain.

## Not yet built (planned route map)

tenants (+ detail), feature flags, recon monitor, audit log, moderation, AI review queue, providers (+ SLA),
plans, billing, platform reports, global catalogue/categories, schemes registry, min-wages, cells,
announcements, support tickets, compliance DSR queue, and tenant impersonation. Intentionally out of scope for
this vertical slice — nav never links to a route that doesn't exist, and no placeholder/TODO pages are shipped.
