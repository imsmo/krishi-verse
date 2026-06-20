# web-tenant

The seller / tenant-admin **console**. Next.js 14 (App Router), server-rendered, built on the shared
`@krishi-verse/sdk-js` + `@krishi-verse/i18n` + `@krishi-verse/tokens`. Authenticated app — never indexed.

## What it serves (built this slice)

- `/login` — phone-OTP sign-in (two Server Actions: request → verify). Enumeration-safe; on success the API
  tokens are stored in httpOnly cookies and the user lands in the console.
- `/dashboard` — server-gated home; greets the staff member from `auth.me()` (degrades if the call fails).
- `/listings` — the tenant's listings (SDK `listings.browse`), keyset "next page", money via `formatMoneyMinor`.
- `/orders` — the tenant's orders (SDK generic `request()` escape hatch, `box=tenant`), keyset paging.
- `POST /api/session` — logout (clears the httpOnly cookies).

## Security / correctness

- **No secrets in the bundle.** Only `NEXT_PUBLIC_API_URL` reaches the browser; `lib/env.ts` is the single env
  reader and fails closed if the origin is unset.
- **Session tokens are httpOnly** (`lib/auth.ts`, `Secure` + `SameSite=Lax`) — unreadable to JS; the SDK reads
  the access token only during SSR. `requireSession()` gates protected pages; **the API re-enforces RBAC + tenant
  scoping on every call**, so the cookie is convenience, never the authority (defence in depth, Law 1/4).
- **Degrade, never die (Law 12).** Pages catch SDK failures and render an empty state — a flaky API never 500s
  the console. Every SDK call is timeout-bounded; GETs retry, mutations don't.
- **Money** is rendered from bigint-minor-unit strings via `formatMoneyMinor` — never a float (Law 2).

## Build note

This Next.js app + React components compile under CI's `pnpm install` (the React/Next toolchain). The shared
packages it stands on — `sdk-js`, `i18n`, `tokens` — are framework-free and are typechecked + unit-tested
offline (this monorepo's `workspace:` deps can't be installed by plain `npm` in the sandbox). The new TSX in this
app is syntax-parsed clean offline and has no broken local imports.

## Not yet built (planned route map)

The full console additionally covers: disputes, payouts, wallet, support inbox, notifications, reports,
listings moderation, KYC queue, ambassadors, commission rules, auctions, group lots, labour (bookings/workers),
dairy MCC, schemes applications, users, and settings (team/branding/commissions/delivery-zones/integrations/
languages/staff-permissions/webhooks/billing). These are intentionally out of scope for this vertical slice —
nav only links to routes that exist (no placeholder/TODO pages are shipped, per the build guide).
