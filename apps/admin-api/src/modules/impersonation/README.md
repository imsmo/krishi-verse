# impersonation (admin-api · god-mode plane, Law 11) — the highest-sensitivity control

Lets a platform **support** operator act AS a specific tenant user to reproduce an issue. Built deliberately to be
safe by construction: every grant is **READ-ONLY**, strictly **time-boxed**, requires a **mandatory reason**, and
**every action taken under it is recorded**. The act-as token is a separately-signed, short-lived credential; an
**impersonation-aware apps/api** honours it (see the integration note). The feature ships with a **kill-switch
default OFF** (Law 10).

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/impersonation/grants` · `/grants/:id` | `impersonation.read` | — (audit list + detail) |
| GET | `/v1/impersonation/grants/:id/actions` | `impersonation.read` | — (per-action audit, keyset) |
| POST | `/v1/impersonation/grants` | `impersonation.grant` | **FIDO2 + step-up** — start a grant; returns the token ONCE |
| POST | `/v1/impersonation/grants/:id/end` | `impersonation.grant` | **FIDO2 + step-up** (operator finished) |
| POST | `/v1/impersonation/grants/:id/revoke` | `impersonation.grant` | **FIDO2 + step-up** (oversight pulls it) |
| POST | `/v1/impersonation/grants/:id/actions` | `impersonation.grant` | — (record one action under the operator's OWN active grant) |

## What it owns
- **Grants** over `impersonation_grants` (0038): who (`admin_user_id`) acted as whom (`target_user_id`) in which
  tenant (`target_tenant_id`), why (`reason`), scope (`read_only`), lifecycle `active→ended|expired|revoked` (Law 5)
  and the hard expiry (`expires_at`). At most ONE active grant per (operator, target) — a partial-unique index.
- **The act-as token** (`domain/impersonation-token.ts`): a short-lived JWT minted on `start`, returned **once**,
  never stored. `typ='impersonation'` (NEVER `'access'`), a dedicated iss/aud, the RFC-8693 `act` (actor=admin)
  claim, the grant `jti`, `scope='read_only'`, and a short `exp`. Signed with a **dedicated** key
  (`IMPERSONATION_TOKEN_SECRET`).
- **Per-action audit** over `impersonation_actions` (0038): an append-only log of every request (method/path) made
  under a grant — beyond the `audit_log` rows written when the grant opens/closes.

## Money / scope path (why it can't escalate)
There is **no path to money/god/write** through impersonation. The token carries no perms array and
`scope='read_only'`; the honouring API derives read-only access from the scope. The target is validated to be a
**non-privileged tenant member** (a user holding any `roles.scope='platform'` role is refused). Money still moves
only via the wallet-service, and a read-only act-as session can never reach it.

## apps/api integration note (the honour-hook — explicitly flagged, not faked)
The token is **fail-closed by design**: because it is `typ='impersonation'` and signed with a dedicated secret, an
un-upgraded `apps/api` (whose `verifyAccessToken` requires `typ='access'` and a different secret) **cannot accept
it** — it simply does nothing until apps/api adds an impersonation-aware verifier that: (1) verifies against
`IMPERSONATION_TOKEN_SECRET` (iss/aud/exp/`typ`), (2) checks the grant `jti` is still `active` + unexpired in
`impersonation_grants`, (3) enforces **read-only** (rejects any mutating method), (4) tags the request context with
the impersonator and POSTs each request to `/v1/impersonation/grants/:id/actions` (or inserts an
`impersonation_actions` row) for the exhaustive per-action audit. `verifyImpersonationToken` here is the reference
implementation apps/api mirrors.

## Threats considered (§4 + Law 11)
- **No privilege escalation (Law 11).** `impersonation.grant`/`impersonation.read` are PLATFORM owner perms (roles
  `platform_support_impersonator`/`platform_impersonation_auditor`); never `*`, never tenant-assignable, never
  money/god (unit-tested). Read-only scope is the only scope; write/full is intentionally excluded.
- **Never act as staff/god.** The target must be an active member of the named tenant (else 404 — no cross-tenant
  enumeration) and must not hold any platform-scoped role (else 403). An operator can never impersonate themselves.
- **Time-boxed + revocable.** Hard TTL cap (`IMPERSONATION_MAX_TTL_SEC`, default 30 min); the token's short `exp`
  bounds exposure even if the grant row isn't checked; `end`/`revoke` close it server-side immediately.
- **JIT elevation + exhaustive audit.** Starting/ending a grant needs a verified admin JWT + the owner perm +
  FIDO2 hardware-key + step-up; guards THROW. Open/close write an `audit_log` row IN THE SAME TX (actor, old→new,
  reason, ip, request_id); every action under the grant is recorded in `impersonation_actions`. `recordAction`
  refuses a foreign/closed/expired grant (404 — no log injection, no writing past the time-box).
- **Kill-switch (Law 10) + fail-closed.** Disabled by default; `start` refuses when off. In production the
  dedicated signing key must be strong (boot refuses otherwise). The token can never be a normal access token.
- **Bounded / validated.** zod `.strict()`; reason min length enforced; ttl bounded; recorded path is a clean URL
  (no query string / PII); keyset pagination (never OFFSET), max LIMIT 100.

## Tests
- Unit (`impersonation.spec.ts`): grant state machine + entity (close-once, expiry); scope/ttl/self guards; token
  round-trip + tamper/expiry/secret/aud/`typ` checks + actor claim + never-`access`; owner-RBAC + no-escalation +
  no-`*`; DTO validation; services proving kill-switch, 404 non-member, 403 privileged, audit-in-tx, illegal
  transition, and recordAction refusing a stale/foreign grant.
- Integration (`impersonation.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): start→record→
  end against a real tenant member — asserting grant state, the time-box, `impersonation_actions`, `audit_log`
  rows, and that re-ending is refused. (Skips its body if the seeded DB has no tenant-scoped membership.)
