# web-admin — build backlog (god-mode console)

**Status today.** `web-admin` is 🟡 — a **thin vertical slice** on the separate `admin-api` security realm
(Law 11), **not** a finished console. What exists and works:

- **Routes:** `/login` (links to the admin IdP `/auth/sso/start`; FIDO2 + step-up enforced by admin-api, no
  password in the UI), `/dashboard` (server-gated god-mode home), `/ai-models` (`GET /v1/ai/models`, keyset),
  `/ai-models/[id]` (model fairness report), `POST /api/session` (logout).
- **Data layer:** `lib/env.ts` (single reader, fail-closed, no secrets in bundle), `lib/admin-client.ts`
  (resilient fetch to admin-api — attaches the admin bearer **server-side only**, timeout-bounds, retries
  idempotent GETs, unwraps `{data,meta}`, maps non-2xx → typed `AdminApiError` with `needsElevation` on 403),
  `lib/admin-auth.ts` (httpOnly `kva_session` cookie, `requireAdmin()`), `components/DataTable.tsx`,
  `styles/globals.css`, `public/robots.txt` (noindex).

**Honest gaps vs. the finished storefront/tenant bar (these are the first things the waves fix):**
1. **No i18n / centralised copy** — every page has hardcoded English literals; there is no `src/i18n` catalog
   nor a `Translator`. (web-admin is an **internal staff-only realm**, so en-primary is acceptable and full
   hi/gu parity is *optional* — but copy must still be centralised, not scattered literals.)
2. **No app shell** — there is no `Sidebar`/nav component; the dashboard hand-rolls links and shows un-built
   surfaces as `"(soon)"`. Needs a red-brand, **elevation/RBAC-aware** nav that links **only to built routes**.
3. **No write path** — `admin-client.ts` exposes only `adminGet`; there is **no mutation helper** (`adminMutate`)
   for the `@Post`/`@Patch`/`@Put`/`@Delete` admin-api endpoints, and no audit-justification header plumbing.
4. **No `loading.tsx` / `error.tsx` / `not-found.tsx` boundaries; no tests; no pure `features/**` modules.**
5. **Read-only, one module** — only `ai-models-ops` reads are surfaced; the 14 other **live** admin-api modules
   (tenants, flags, recon, compliance, billing, plans, providers, support, impersonation, announcements,
   catalogue, schemes-registry, cells, platform-reports) have **no UI**, and even `ai-models` lacks its
   promote/threshold mutations.

Everything below is **frontend-only**: `admin-api` (✅) already exposes the endpoints these tasks consume — the
controllers are inventoried per wave. **No new backend.** The app's own `admin-client.ts` is *not* a shared SDK,
so adding typed methods/helpers to it is in-scope (mirror the controller exactly; never invent a route). If an
endpoint a task needs genuinely doesn't exist in `admin-api`, **STOP and flag it** rather than faking it.
Hand me one `Yes next AD-Wx-yy …` at a time with the contract (§1) pasted, exactly like the storefront / tenant /
mobile cadence.

> **Realm reminder (Law 11 — god-mode is NOT tenant-scoped).** Every admin-api call is re-authorised server-side
> for **owner RBAC + hardware-key + step-up freshness**; a `403` is surfaced as `needsElevation` (prompt re-auth),
> never a crash, and the UI only *reflects* what admin-api allows. God-mode reads/writes are **audit-logged
> server-side** — mutations must carry the operator's justification where the endpoint expects it. This console
> NEVER holds the admin token in the browser and NEVER calls the tenant API.

---

## 1. THE PRODUCTION-GRADE CONTRACT — admin-console variant (paste at the top of every command)

```
PRODUCTION-GRADE CONTRACT (web-admin) — obey for everything you build:
- This is the PLATFORM GOD-MODE console for Anthropic-side operators, under active attack. Build production, not a
  demo. It is an AUTHENTICATED, ELEVATED app — every page is noindex; there is no public surface; the brand is RED
  to signal the elevated realm.
- SEPARATE REALM (Law 11): talk ONLY to admin-api via lib/admin-client.ts — NEVER the tenant API, NEVER the tenant
  SDK. admin-api re-enforces owner RBAC + FIDO2 + step-up freshness on EVERY call; the cookie is convenience, never
  the authority. A 403 → AdminApiError.needsElevation degrades to a clear "re-authenticate / insufficient
  elevation" notice, never a crash, and never leaks another tenant's or operator's data.
- DATA ACCESS ONLY VIA admin-client.ts. Server Components / Server Actions / Route Handlers call adminGet (reads)
  or the mutation helper (writes); the admin bearer is attached SERVER-SIDE ONLY (server-only import). Browser code
  never holds the token. Add typed methods to admin-client by MIRRORING the admin-api controller exactly — never
  invent a path/verb. If admin-api lacks the endpoint, STOP and flag it.
- SECRETS: only NEXT_PUBLIC_* may reach the browser (lib/env.ts is the single reader, fail-closed). The admin
  session token stays in the httpOnly+Secure+SameSite=Strict cookie (lib/admin-auth.ts) — never readable by JS,
  never serialised into HTML/props/client JS.
- AUDIT: god-mode mutations are audit-logged by admin-api; pass the operator's justification where the endpoint
  expects it (e.g. tenant suspend, account freeze, plan pricing change). Mutations are Server Actions / Route
  Handlers and pass an Idempotency-Key where the endpoint exposes one; GETs may retry, mutations never auto-retry.
- MONEY is rendered from bigint MINOR-UNIT STRINGS via a money formatter — never a float (Law 2). Metrics that are
  ratios/counts are computed float-free where the value is money-derived.
- DEGRADE, NEVER DIE (Law 12): every admin-api call is timeout-bounded; pages catch failures and render an
  empty/error/needsElevation state — a flaky admin-api never 500s the console.
- LIFECYCLE: state transitions (tenant approve/suspend/archive, flag/plan/scheme/announcement/cell status, recon
  investigation, DSR/breach, impersonation grant) reflect the server state machine — only legal actions are shown;
  a 409 degrades to a message.
- ACCESSIBILITY + COPY: semantic HTML, labelled controls, keyboard-navigable; ALL copy via the central i18n catalog
  (en primary; admin is an internal realm so hi/gu parity is OPTIONAL but copy must NOT be hardcoded literals);
  loading.tsx + error.tsx boundaries per route segment; noindex metadata on every page.
- Before "done": `npm run typecheck` (tsc --noEmit, exit 0) + `npm run lint` (next lint) + `npm run build`
  (next build emits .next) + `npm test` green; self-audit against §4 below; PASTE the green output. Red = not done.
```

> Build-sandbox note (same caveat the storefront/tenant recorded): this monorepo's `workspace:*` deps can't be
> installed by plain `npm` in the sandbox, so the gate that always runs here is the **static §4 self-audit**;
> `tsc --noEmit` + `next lint` + `next build` + `jest` run in CI's `pnpm` toolchain. State that explicitly in each
> session's verification.

---

## 2. PRE-FLIGHT — read before writing a line (every session)
1. `apps/web-admin/README.md` + the existing `src/` (lib/{env,admin-client,admin-auth}.ts, the built pages,
   DataTable, globals.css), AND the finished `apps/web-tenant/src/` + `apps/web-storefront/src/` (Sidebar,
   lib/i18n.ts, i18n catalogs, Server-Action + loading/error boundary patterns) — the gold-standard structure to
   mirror (adapted to the admin-client, not the SDK).
2. The admin-api surface you'll consume: `apps/admin-api/src/modules/<module>/*.controller.ts` (the exact
   `@Controller` path + verbs) and the module's DTOs/read-models for the response shapes. **Match the controller
   exactly; never guess a path or field.** Live modules + their controller roots:
   - `tenant-ops` → `tenants` (GET list, GET :id, POST :id/approve|suspend|archive, PATCH :id/limits)
   - `flags-ops` → `flags` (GET, GET :key, GET :key/history, POST, PATCH :key)
   - `recon-monitor` → `recon` (GET overview|runs|runs/:id|accounts/:id|investigations[/:id], POST investigations,
     PATCH investigations/:id, POST accounts/:id/freeze)
   - `compliance-ops` → `compliance` (GET dsr[/:id], PATCH dsr/:id, GET exports, POST exports/:id/decision,
     GET audit|retention, POST retention, GET breaches[/:id], POST breaches, PATCH breaches/:id)
   - `billing-ops` → `billing` (GET revenue|invoices[/:id]|invoices/:id/dunning|adjustments, PATCH invoices/:id,
     POST invoices/:id/dunning, POST adjustments)
   - `plans-ops` → `plans` (GET, GET features, GET :id[/history], POST, PATCH :id, PATCH :id/pricing,
     POST :id/version, PUT/DELETE :id/features/:code, PUT/DELETE :id/limits/:code)
   - `providers-ops` → `providers` (GET health|financial|list|:code[/history], PATCH :code)
   - `support-oversight` → `support` (GET tickets|sla-breaches|tenant-health|tickets/:id, POST tickets/:id/escalate)
   - `impersonation` → `impersonation` (GET grants[/:id][/:id/actions], POST grants, POST :id/end|revoke|actions)
   - `announcements` → `announcements` (GET active|list|:id|:id/history, POST, PATCH :id,
     POST :id/schedule|publish|expire|archive)
   - `global-catalogue-ops` → `catalogue` (lookup-types, lookup-values, categories — CRUD + history + active/move)
   - `schemes-registry-ops` → `schemes-registry` (authorities, schemes, schemes/calendar — CRUD + rules/window/active)
   - `cells-ops` → `cells` (residency-report, placements, shards, cells — CRUD + status/move/default/residency-lock)
   - `platform-reports` → `reports` (GET overview|gmv|tenant-growth|regulator-export)
   - `ai-models-ops` → `ai/models` (GET, GET :id, GET :id/fairness, POST, POST :id/promote, PATCH :id/threshold)
3. `lib/{env,admin-client,admin-auth}.ts` — use these; never read `process.env` elsewhere, never build a second
   fetch client, never attach the bearer outside admin-client.
4. The i18n catalog (once AD-W0 lands) — add keys there, never inline literals.

---

## 3. WHAT TO BUILD — Next.js App Router conventions (mirror the finished tenant console)
- **Routes** in `src/app/**` stay THIN: a Server Component resolves data via `admin-client` and renders
  presentational components. All god-mode pages are dynamic (authed + elevated). Interactivity uses small
  `'use client'` components only where needed.
- **Mutations** are **Server Actions** / **Route Handlers** — the only place the admin bearer is used for writes;
  they pass the audit justification + Idempotency-Key where the endpoint expects them, then
  `revalidatePath`/`redirect` on success, and map `AdminApiError` (409 illegal / 403 needsElevation / etc.) to a
  clear localized message.
- **Cross-route logic** (status maps, table configs, money/metric math, the elevation-aware nav model) lives in
  `src/features/**` as PURE, unit-tested modules; shared UI in `src/components/**`. Every fetching route segment
  gets `loading.tsx` + `error.tsx`; the app gets a root `not-found.tsx`.
- **Auth + elevation gating**: `requireAdmin()` redirects unauthenticated operators to `/login`; admin-api enforces
  owner RBAC + hardware-key + step-up per call; the UI hides actions the operator can't perform and surfaces
  `needsElevation` as a re-auth prompt (reflecting, never granting).

---

## 4. SECURITY / QUALITY CHECKLIST (self-audit before "done")
- [ ] No secret reaches the browser bundle (only `NEXT_PUBLIC_*`; `admin-client`/`admin-auth` are `server-only`; nothing server-only imported into a client component).
- [ ] Admin token only in the httpOnly `kva_session` cookie; never serialised into HTML/props/client JS; the bearer is attached only inside `admin-client`.
- [ ] Every authed mutation goes through a Server Action / Route Handler, passes the audit justification + Idempotency-Key where the endpoint exposes them, and never auto-retries.
- [ ] Every page is `requireAdmin`-gated + noindex; a missing/foreign id → `notFound()`; a `403` degrades to a clear `needsElevation` re-auth notice (admin-api is the authority).
- [ ] Money rendered via the minor-unit money formatter (never a float; never `toFixed`/`parseFloat` on money).
- [ ] Pages degrade (try/catch → empty/error/needsElevation state), never 500; admin-api calls are timeout-bounded; GET-only retries.
- [ ] All copy via the central i18n catalog (en; hi/gu optional for this internal realm — but NO hardcoded literals); semantic + keyboard-accessible markup; localized loading/error boundaries; red-brand elevated chrome.
- [ ] `tsc --noEmit` + `next lint` + `next build` + `jest` green (paste output; note they run in CI's pnpm toolchain).

---

## 5. THE ONE-PER-SESSION PLAN
Pick the lowest-numbered unchecked task whose dependencies are met and send:

> `Yes next AD-W0-01 admin-foundation-refit but follow the web-admin Production-Grade Contract pasted below.` + the contract (§1).

After each task: green gate → I tick it ✅ here and refresh the `web-admin` cell in `apps/api/MODULE_STATUS.md`.
When the last box is ticked, `web-admin` flips to ✅.

---

## WAVE 0 — foundation refit (do first; everything else depends on it)
- [x] **AD-W0-01 · admin-foundation-refit** — central i18n catalog (`src/i18n` en, Translator wired like the
  tenant `lib/i18n.ts`; hi/gu optional/flagged for this internal realm) replacing all hardcoded literals; a
  red-brand, **elevation/RBAC-aware** `Sidebar` (links ONLY to built routes; `"(soon)"` items are non-links until
  their wave lands); root `layout` chrome + `loading.tsx`/`error.tsx`/`not-found.tsx` boundaries (error.tsx renders
  the `needsElevation` re-auth prompt for 403s); **extend `admin-client.ts` with a typed mutation helper**
  (`adminMutate`/`adminPost`/`adminPatch`/`adminDelete`: server-only, audit-justification + Idempotency-Key
  plumbing, NO auto-retry) + a pure `features/nav` model; rewrite `/login`, `/dashboard`, `/ai-models[/id]` onto
  the refined shell; `jest` + a pure-helper unit test; token-driven CSS. (No new admin-api; mutation helper just
  wraps fetch.)

## WAVE 1 — tenants (the core god-mode surface)
- [x] **AD-W1-01 · tenants-console** — `/tenants` (`GET /v1/tenants`, keyset + status filter) + `/tenants/[id]`
  (`GET /v1/tenants/:id`) with the lifecycle actions surfaced only when legal: **approve / suspend / archive**
  (`POST :id/approve|suspend|archive`, audit justification) and **edit quota limits** (`PATCH :id/limits`). Pure
  tenant-state + limits-form helpers (unit-tested). Money/usage via the formatter.

## WAVE 2 — platform reports & feature flags
- [x] **AD-W2-01 · platform-reports** — `/reports`: overview (`GET /v1/reports/overview`), GMV (`gmv`),
  tenant-growth (`tenant-growth`), and a regulator-export download (`regulator-export`). Float-free money/metric
  math in a pure module (unit-tested); each panel degrades independently.
- [x] **AD-W2-02 · feature-flags** — `/flags` (`GET /v1/flags`) + `/flags/[key]` (`GET :key` + `GET :key/history`)
  with **create** (`POST`) and **change/rollout** (`PATCH :key`) as Server Actions (audit justification). Pure
  rollout/flag-state helper (unit-tested).

## WAVE 3 — money & risk oversight
- [x] **AD-W3-01 · recon-monitor** — `/recon`: overview (`GET /v1/recon/overview`) + runs (`runs`, `runs/:id`) +
  account drill-down (`accounts/:id`) + investigations (`investigations[/:id]`, **open** `POST investigations`,
  **update** `PATCH investigations/:id`) and **freeze account** (`POST accounts/:id/freeze`, audit justification).
  Pure investigation-state helper (unit-tested); money via the formatter.
- [x] **AD-W3-02 · billing-ops** — `/billing`: revenue (`GET /v1/billing/revenue`) + SaaS invoices
  (`invoices[/:id]`, `invoices/:id/dunning`) + adjustments (`adjustments`), with **edit invoice** (`PATCH
  invoices/:id`), **run dunning** (`POST invoices/:id/dunning`) and **post adjustment** (`POST adjustments`,
  money-safe, audit justification). Pure money helpers (unit-tested).

## WAVE 4 — plans, providers, support
- [x] **AD-W4-01 · plans-ops** — `/plans` (`GET /v1/plans` + `GET features`) + `/plans/[id]` (`:id`, `:id/history`)
  with **create** (`POST`), **edit** (`PATCH :id`), **pricing** (`PATCH :id/pricing`, money-safe), **new version**
  (`POST :id/version`), and **feature/limit** set/clear (`PUT|DELETE :id/features/:code`, `…/limits/:code`). Pure
  plan/pricing helpers (unit-tested).
- [x] **AD-W4-02 · providers-ops** — `/providers`: health (`GET /v1/providers/health`) + financial
  (`financial`) + registry (`GET`, `:code`, `:code/history`) with **enable/disable** (`PATCH :code`, audit — the
  only `PATCH :code` the API exposes; providers carry no editable config, secrets live in the vault). Pure
  provider-health/state helper (unit-tested). Health = persisted config coverage (degraded = disabled-but-
  referenced), not real-time latency; the toggle is surfaced only when it is a real change (admin-api rejects a
  no-op → 409).
- [x] **AD-W4-03 · support-oversight** — `/support`: tickets (`GET /v1/support/tickets`, `tickets/:id`) +
  SLA-breaches (`sla-breaches`) + tenant-health (`tenant-health`) with **escalate** (`POST tickets/:id/escalate`,
  audit — raise-only severity / status→escalated / reassign; surfaced only when escalatable, server enforces
  must-change). Pure SLA/ticket-state helper (unit-tested). Money-free helpdesk.

## WAVE 5 — compliance, impersonation, announcements
- [x] **AD-W5-01 · compliance-ops** — `/compliance`: DSR queue (`GET /v1/compliance/dsr[/:id]`, **decide** `PATCH
  dsr/:id`), data-export approvals (`exports`, `POST exports/:id/decision`), breaches (`breaches[/:id]`, `POST`,
  `PATCH :id`), retention (`retention`, `POST retention`), and the audit read (`audit`). Pure DSR/breach-state
  helpers (unit-tested). PII-minimal rendering; never expose raw subject data beyond what the endpoint returns.
  DSR + breach lifecycle actions surfaced only when legal; breach "notify" requires both DPDP §8 timestamps; export
  decidable only while pending; retention month-windows are float-free; audit explorer is a read-only GET-form over
  the PII-free log.
- [ ]- [x] **AD-W5-02 · impersonation** — `/impersonation`: grants (`GET /v1/impersonation/grants[/:id]`,
  `:id/actions` audit trail) with **mint grant** (`POST grants`, justification + scope), **end** (`:id/end`),
  **revoke** (`:id/revoke`). Strong warnings; the scoped token is minted/held server-side, never shown to JS.
  Read-only scope only, time-boxed (60–3600s), ≥8-char justification; end/revoke surfaced only while active
  (pure grant-state helper, unit-tested); the act-as token returned once by `POST grants` is received in the
  Server Action and deliberately discarded — never serialised to the browser. `recordAction` is a machine-only
  endpoint and is intentionally not surfaced.
- [ ]- [x] **AD-W5-03 · announcements** — `/announcements` (`GET /v1/announcements` + `active` + `:id` + `:id/history`)
  with **create** (`POST`), **edit** (`PATCH :id`) and the lifecycle (`schedule|publish|expire|archive`) surfaced
  only when legal. Pure announcement-state helper (unit-tested). Plain-text content (HTML rejected), audience
  allowlists (plan/country), ISO schedule windows; edit only while draft/scheduled (published = immutable → 409);
  the live-now set shown from `/active`.

## WAVE 6 — global registries (config that the tenant SDK can't reach)
- [x] **AD-W6-01 · global-catalogue-ops** — `/catalogue`: lookup-types + lookup-values (+history, active toggle) +
  category tree (children, move, active) — CRUD via Server Actions. Pure tree/lookup helpers (unit-tested).
  Codes/slugs charset-bounded, meta is a flat JSON object, sortOrder/minAge float-free; category move is
  cycle/depth-checked server-side; immutable codes; activate/deactivate reject no-ops.
- [ ] - [x] **AD-W6-02 · schemes-registry-ops** — `/schemes-registry`: authorities (+history) + schemes (+calendar,
  +history) with **create/edit**, **rules** (`:id/rules`), **window** (`:id/window`), **active** (`:id/active`).
  Pure scheme-window/state helper (unit-tested). Code immutable; benefit/eligibility are non-empty JSON; window is
  MM-DD; processing fee is a minor-unit digit string via formatMoneyMinor; rules edit bumps version (snapshot
  integrity); calendar is a read-only open-on-date view.
- [x] **AD-W6-03 · cells-ops** — `/cells`: residency-report + placements (move/remove) + shards (status/history) +
  cells (status, default, residency-lock, history) — CRUD via Server Actions. Pure placement/residency helper
  (unit-tested). Data-residency warnings on lock/move.
- [x] **AD-W6-04 · ai-models-actions** — extend the existing `/ai-models[/id]` with the **promote** (`POST
  :id/promote`) and **threshold** (`PATCH :id/threshold`) mutations as Server Actions (audit justification),
  surfaced only when legal for the model state. Pure model-state/threshold helper (unit-tested).

## WAVE 7 — quality & DoD
- [x] **AD-W7-01 · admin-test-and-polish** — unit tests for every pure `features/**` module (state machines,
  money/metric math, the nav/elevation model), a11y pass (landmarks/labels/keyboard, red-brand contrast),
  `loading.tsx`/`error.tsx` coverage on every fetching segment (+ root `not-found`), noindex on every route, the
  `needsElevation` re-auth path verified, and a final `tsc`/`lint`/`build`/`jest`-green sweep. Closes the console
  DoD; flips `web-admin` to ✅.

---

## 6. PER-TASK COMPLETION RITUAL
1. `tsc --noEmit` + `next lint` (+ `next build` + `jest`) green (paste output; note they run in CI's pnpm toolchain).
2. New routes/components/Server Actions follow the thin-route + admin-client-only + httpOnly-session + elevation-gated pattern; new `admin-client` methods mirror the admin-api controller exactly.
3. i18n keys added (en; no hardcoded literals); money via the minor-unit formatter; a11y + noindex metadata + loading/error boundaries in place; mutations carry audit justification + Idempotency-Key where the endpoint exposes them.
4. README "What it serves" updated; this backlog box ticked; `web-admin` cell in `MODULE_STATUS.md` refreshed.
5. Self-audit §4 clean. Only then is the task done.

*North star: every page is server-first, secret-free, owner-RBAC + elevation-respecting, money-safe, accessible,
audit-logged on writes, and degrades instead of dying — talking ONLY to the admin-api realm via the typed
admin-client. Never reach past admin-api; flag the gap instead.*
