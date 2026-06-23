# web-storefront

The public consumer site + per-tenant storefronts + the public farm-to-fork QR landing. Next.js 14 (App
Router), server-rendered, built on the shared `@krishi-verse/sdk-js` + `@krishi-verse/i18n` + `@krishi-verse/tokens`.

## What it serves

- `/` — public home: SSR sample of published listings (anonymous SDK browse), ISR-cached.
- `/[tenantSlug]` — a tenant's storefront: tenant-scoped listing browse (SDK sends `X-Tenant-Slug`) + search +
  keyset "next page".
- `/[tenantSlug]/listings/[id]` — listing detail; `notFound()` on a missing listing.
- `/trace/[qrToken]` — **public** farm-to-fork provenance: anonymous `traceability.scan` (the API's NON-PII
  SECURITY-DEFINER projection), SEO-indexed, 404 on unknown/disabled token.
- `/about`, `/blog`, `/help`, `/pricing`, `/press`, `/tenants-signup` — marketing/static surface. Static
  localized copy (the SDK exposes no `cms` resource), each with `generateMetadata`; `/blog` renders an empty
  state until a content source exists; `/tenants-signup` CTA links to the seller console (`env.tenantAppUrl`)
  or falls back to `/login`.

## App shell

A shared **header** (brand, primary nav, locale switcher, cart badge, login link) + **footer** wrap every page
from `app/layout.tsx`, which sets `<html lang/dir>` from the active locale and renders a skip-to-content link.
**i18n** is server-side: `lib/i18n.ts` resolves the locale (`kv_lang` cookie → `Accept-Language` → default) and
builds an `@krishi-verse/i18n` Translator over the `en`/`hi`/`gu` catalogs (full key parity; **no inline copy**
in components/pages). Locale switching works **without client JS** — a `<form>` posts to `/api/lang`, which
validates fail-closed against the supported set and 303-redirects back (same-origin guard, no open redirect).
Segment `loading.tsx`/`error.tsx`/`not-found.tsx` boundaries are localized; `error.tsx` is the one client
component, reading the cookie to localize. A shared accessible `components/DataTable.tsx` (caption, empty state,
keyset "next" — never OFFSET) is ready for the authed lists in later waves.

## Security / correctness

- **No secrets in the bundle.** Only `NEXT_PUBLIC_*` (the API origin) reaches the browser; the server-only API
  URL + token live server-side. `lib/env.ts` is the single env reader and fails closed if the origin is unset.
- **Session token is httpOnly** (`lib/auth.ts`, `Secure`+`SameSite=Lax`) — unreadable to JS, so XSS can't
  exfiltrate it; the SDK reads it only during SSR.
- **Degrade, never die (Law 12).** Public pages catch SDK failures and render an empty state — a flaky API never
  500s the storefront. Every SDK call is timeout-bounded; GETs retry, mutations don't.
- **Money** is rendered from bigint-minor-unit strings via `formatMoneyMinor` — never a float (Law 2).
- **Tenant scoping** is server-side (the API enforces it); the slug only selects which tenant's public catalogue
  to show.

## Build note

This Next.js app + React components compile under CI's `pnpm install` (the React/Next toolchain). The shared
packages it stands on — `sdk-js`, `i18n`, `tokens` — are framework-free and are typechecked + unit-tested
offline (this monorepo's `workspace:` deps can't be installed by plain `npm` in the sandbox).

## Remaining web apps (separate sessions)

`web-tenant` (seller/tenant-admin console), `web-admin` (platform god-mode UI on admin-api), and `web-partner`
(financial/logistics partner portal) follow the same pattern on the same SDK + tokens + i18n foundation.
