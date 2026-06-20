# cms (PRD §50) — content pages + promotional banners

Tenant-managed CMS: versioned content pages (policies / FAQ / help articles / static) and scheduled banners.
Money-free. Gated by the `cms` feature flag (default **OFF**).

## What it owns

- **Pages** (`cms_pages`) — **versioned** per slug (`UNIQUE(tenant_id, slug, version)`). Lifecycle via the
  state machine (Law 5): `draft → published → archived`. A page is created as a draft (the next version for its
  slug); editing is allowed **only while draft**; publishing stamps `published_at` and **archives the slug's
  previously-published version** so exactly one is live; a published page is re-edited by minting a new version
  (a fresh draft) — the live content is never mutated. Body is markdown. Platform pages have `tenant_id NULL`
  (admin-api only, Law 11 — not writable here).
- **Banners** (`banners`) — a scheduled placement that runs in `[starts_at, ends_at)`; `is_active` is the manual
  on/off; **live** = active ∩ inside the window. `click_count` is incremented atomically (`+1` in SQL, no
  read-modify-write race). An expiry job deactivates ended banners.

## Surface (v1, under the `cms` flag)

Pages (`cms.manage` to write): `POST /v1/cms/pages`, `GET` (admin list), `PATCH /:id`, `POST /:id/{publish,
archive}`, `GET /:id` (admin). `GET /v1/cms/pages/by-slug/:slug` serves the live page to any authenticated user.
Banners: `POST /v1/cms/banners` (`cms.manage`), `GET` (box=`live` any user, `all` agent), `GET /:id`
(`cms.manage`), `POST /:id/{activate,deactivate}` (`cms.manage`), `POST /:id/click` (any user).

## Threats considered (§4)

- **Tenant isolation / RLS** — `tenant_id` binds every query; `cms_pages` + `banners` are RLS-protected
  (pages also allow NULL = platform pages, read-only here). Authoring always writes the caller's own tenant_id.
- **No privilege escalation** — create/publish/archive + banner management require `cms.manage`; platform pages
  aren't writable via the tenant API. Publish/archive write an `audit_log` row in the same tx.
- **Input validation** — slug is anchored kebab-case (ReDoS-safe), banner/target URLs are anchored http(s)
  (blocks `javascript:`/SSRF bait), banner window is validated (`ends_at > starts_at`).
- **Abuse/DoS** — bounded list `LIMIT` + keyset pagination; click is a single atomic UPDATE (no amplification);
  banner-expiry job is bounded per run.
- **Immutability** — a published page version cannot be edited (a new version is required), so live legal/policy
  content has a stable, auditable history.

## Deferred (schema present, not built)

Per-language page translations (the `translations` table); banner audience-rule targeting evaluation (rules are
stored, not yet matched at serve time); page preview tokens; scheduled (future-dated) page publish.

## Tests

`__tests__/cms-domain.spec.ts` (slug/window validation, draft-only edit, page state machine, banner isLive),
`cms-page.service.spec.ts` (version minting, cms.manage gate, single-live publish + audit, public getBySlug),
`tenant-isolation.spec.ts` (CI gate: tenant/platform scoping, published-only serve, atomic click, keyset),
`cms.integration.spec.ts` (real Postgres: create→publish v1 → v2 publish archives v1 → public latest →
banner + click → cross-tenant RLS denial; runs when `DATABASE_URL` is set).
