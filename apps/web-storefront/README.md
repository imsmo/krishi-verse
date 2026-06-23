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

## Listing detail

`/[tenantSlug]/listings/[id]` (SSR + ISR, `notFound()` on miss) is enriched with a price/quantity block, the
localized sale type, a **seller trust card** and **listing reviews summary** (both via the public
`reviews.summary` aggregate — they degrade silently if unavailable), buyer CTAs, a farm-to-fork note, and rich
**OpenGraph / Twitter / canonical** metadata. `BuyerActions` picks the CTA by sale type: purchasable listings
get an **add-to-cart** form (`cart.addItem`) and offer-capable listings a **make-an-offer** form (`offers.make`,
Idempotency-Keyed). Both are authed Server Actions — `requireSession` redirects anonymous users to login with a
return path, the mutation runs through `serverClient(tenantSlug)`, qty/price are validated server-side, and the
page shows a localized `?status=` notice (works without client JS).

**Not built (read-model has no field — flagged, not faked):** the `ListingCard` read-model carries no media ids,
no trace `qrToken`, and no `auctionId`, so a **media gallery**, a direct **`/trace/[qrToken]` provenance
deep-link** (we link to the `/help` traceability explainer instead), and a **place-bid-from-listing** CTA can't
be built without inventing data. These unblock once the SDK listing read-model exposes media / trace-token /
auction-link fields. Auction and service listings show a localized "opens in the app" note instead of a button.

## Cart

`/cart` is a protected, dynamic page (`requireSession` → anon to `/login?next=/cart`) that reads the
authoritative cart from the authed SDK on every view — prices and availability are always the server's truth,
never a stale client total. Quantity-update, remove, and clear are Server Actions (`serverClient().cart.*`,
`revalidatePath('/cart')`; the SDK cart mutations are naturally idempotent and expose no Idempotency-Key). Line
totals and subtotal render via `formatMoneyMinor` (platform currency INR; the cart read-model has no per-line
currency code, matching the formatter default). The page surfaces `priceChanged` / unavailable warnings and
gates checkout until unavailable lines are removed. The header shows a live cart **badge** via
`features/cart/summary.getCartItemCount()` (anonymous or on failure → 0, no network for anonymous visitors).
The checkout CTA points to `/checkout` (built in SF-W3-02; degrades to the localized 404 until then).

## Checkout & payment

`/checkout` (protected, dynamic) reviews the cart, lets the buyer pick a saved address and enter an optional
coupon, then `placeOrderAction` calls `checkout.checkout` under a **stable per-render Idempotency-Key** (hidden
field) so a refresh/double-submit can't double-create orders. It redirects to `/checkout/pay`, where `PayButton`
(the only client component in the money path) runs the real Razorpay flow: a server action creates the payment
intent from the order's **authoritative** total (`payments.createIntent`, purpose `direct_order`, referencing the
order) under a **stable `order-pay:<orderId>` key** so re-clicks reuse the same gateway order — never a
double-charge — then opens Razorpay with the **publishable** key (`NEXT_PUBLIC_RAZORPAY_KEY_ID`; the session token
never reaches the browser), and polls `payments.get` for the authoritative status (capture is verified by the
signed server webhook, not the client). `/checkout/confirm` shows the server-computed
subtotal/delivery/discount/tax/total breakdown and line items. Money is minor-unit strings end-to-end via
`formatMoneyMinor`. **Fail-closed:** no publishable key → "online payments unavailable"; a failed or cancelled
payment offers retry (never auto-retried); a pending capture shows "we'll confirm shortly".

**Not available in the SDK (flagged):** there is no coupon **discount-preview** endpoint and no **delivery-methods**
lookup, so the discount/charges/tax are computed at order placement and shown on the confirmation (the checkout
page states this), and `deliveryMethodId` is omitted. Multi-seller checkout creates one order per seller; the pay
step settles the primary order and confirmation links to "my orders" (SF-W3-03) for any others.

## Orders

`/orders` (protected, dynamic) lists the buyer's orders (`orders.list` role=buyer, keyset) through the shared
accessible `DataTable` — order number (link), localized status, seller, total (`formatMoneyMinor`), date
(`formatDate`). `/orders/[id]` reads `orders.get` and `notFound()`s on a missing or foreign id (RLS-scoped, no
IDOR); it shows a localized **status timeline** (pure `features/orders/timeline.ts` → `OrderTimeline`, with a
cancelled/disputed terminal banner), the line items, the server-computed subtotal/delivery/discount/tax/total
breakdown, and **shipment tracking** via `shipments.list({orderId})` (status, tracking number, pickup/delivered
timestamps, OTP note — degrades to "no shipment yet" when the logistics flag is off or none exist).

**Not available in the SDK (flagged):** there is no invoice resource or download method (no `payments.invoices`,
no `orders.invoice`), so invoice download is deferred until the SDK exposes one.

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
