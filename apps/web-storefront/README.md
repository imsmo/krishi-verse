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

## Discovery (search & filters)

The tenant storefront (`/[tenantSlug]`) is a faceted discovery surface driven entirely by URL searchParams, so
every filtered view is a shareable, bookmarkable link and the browser back button just works. `SearchFilters` is
a no-JS `<form method="get">`; `features/discovery/query.ts` (pure, framework-free) maps the searchParams to a
typed `listings.browse` query and back. Facets: full-text `q`, **sale type**, **organic-only**, **price band**
(major-unit input → minor-unit string via integer math — never a float, Law 2), and **sort**. Paging is keyset
("show more" is a real next-page link that preserves all filters). Localized results-count, zero-result, and
empty states; changing a filter restarts paging.

**Not yet built (no SDK surface — flagged, not faked):** a *named* category-navigation tree, a region/pincode
picker, and attribute facets need a categories / regions / attributes **lookup** resource that the SDK does not
expose. `listings.browse` accepts `categoryId`/`regionId`, so those are honoured as transparent URL passthrough
(deep links filter correctly) — but the storefront will not render fabricated category/region names. A named UI
is unblocked once the SDK adds e.g. `catalogue.categories()` / `geo.regions()`.

## Authentication

Phone-OTP sign-in at `/login`. A single `loginAction` Server Action (`app/login/actions.ts`, two steps —
request code, then verify — chosen by the form's `intent`) calls the SDK `auth` resource via the anonymous
`publicClient()`; on a successful verify the returned tokens are written into two httpOnly+Secure+SameSite
cookies — `kv_session` (access, lifetime = the token's `expiresInSec`) and `kv_refresh` (refresh, 30-day cap)
— and the browser is redirected to a validated same-origin `next`. The browser never sees a raw token. The
flow is enumeration-safe (requesting a code always shows the same neutral notice), carries a `randomUUID`
Idempotency-Key on every call, shows one generic verify error, and never renders the OTP. Logout (`logoutAction`)
clears both cookies. `lib/session.ts` provides silent refresh (`refreshSession()` mints a new access token from
the refresh cookie server-side when the access cookie has expired) and `requireSession(returnTo)`, the gate for
protected routes (account/cart/checkout/orders in later waves) that redirects anonymous users to
`/login?next=…`. The header shows a sign-out button when a session cookie is present, a sign-in link otherwise.

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
