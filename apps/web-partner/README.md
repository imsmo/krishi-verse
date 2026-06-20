# web-partner

The financial / logistics **partner portal** — banks/NBFCs process loan applications; insurers process policies
& claims. Next.js 14 (App Router), server-rendered, built on the shared `@krishi-verse/sdk-js` +
`@krishi-verse/i18n` + `@krishi-verse/tokens`. Partner-scoped auth; never tenant data beyond consented
applications. Never indexed.

## What it serves (built this slice)

- `/login` — phone-OTP sign-in (two Server Actions). On success the API tokens (carrying partner-scoped
  permissions like `loan.manage`) are stored in httpOnly cookies.
- `/dashboard` — pipeline KPIs rolled up from the lender review queue (awaiting / approved / pending exposure).
- `/loan-queue` — applications routed to this partner (`fintech/loan-applications?box=review`), keyset paging.
- `/loan-queue/[id]` — application detail + **lender decision** Server Actions against the real endpoints:
  `review` → under_review, `approve` (amount + cooling-off window), `reject` (note), `disburse`
  (Idempotency-Key, Law 3). The state machine + partner RBAC on the API are the authority; the UI only offers
  the actions valid for the current status.
- `POST /api/session` — logout (clears the httpOnly cookies).

## Security / correctness

- **Partner scoping is server-side.** The API only ever returns applications routed to this partner (RLS +
  partner RBAC); the portal can't page into another lender's book.
- **Session tokens are httpOnly** (`partner-auth.ts`, `Secure` + `SameSite=Lax`) — unreadable to JS; the SDK
  reads the access token only during SSR. `requirePartner()` gates protected pages.
- **Money is bigint minor units (Law 2).** Displayed via `formatMoneyMinor` (no float); the approve form takes
  whole rupees and converts via `BigInt` to paise — never a float multiply. Mutations send an Idempotency-Key
  where the API requires one; GETs retry, mutations don't.
- **No secrets in the bundle** (`lib/env.ts`, single reader, fail-closed). **Never indexed.** **Degrade, never
  die (Law 12):** failures render an empty state / inline notice, never a 500.

## Build note

The Next.js app + React compile under CI's `pnpm install`. The shared packages (`sdk-js`, `i18n`, `tokens`) are
framework-free and typechecked + unit-tested offline. New TSX in this app is syntax-parsed clean offline with no
broken local imports.

## Not yet built (planned route map)

claims queue (+ detail), disbursals, policies, portfolio, SLA report, API credentials, and settings.
Intentionally out of scope for this vertical slice — nav never links to a route that doesn't exist, and no
placeholder/TODO pages are shipped (per the build guide).
