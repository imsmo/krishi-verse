# identity module (PRD M01)

The platform's identity, authentication, and dynamic-RBAC core. Follows the `listings`
blueprint (domain → dto → services → repositories → controllers, tenant-isolation + tests).

## What it owns
- **Users** — one global, phone-keyed identity per human (E.164). PII (Aadhaar/PAN/bank) is
  NEVER stored raw — only last-4 + external vault refs; `toPublic()` masks everything.
- **Dynamic RBAC** — roles, permissions, role→permission grants, `user_tenant_roles`
  (person × tenant × role, with approval gating), and per-staff permission overrides. All
  data, not code (Law 6) — a new role is an INSERT (db/seeds 0004).
- **KYC** — document submit + admin review (state machine), expiry tracking.
- **Addresses / bank accounts** — owner-scoped; bank accounts are tokenised (vault_ref).
- **Consents** — DPDP, append-only history. **Data-subject requests** — access/erasure/etc.
- **Sessions & devices**, **login events** (security trail), **risk scoring**.

## Authentication flow (phone-OTP first — rural-friendly)
1. `POST /v1/auth/otp` → OTP issued via Redis (hashed, rate-limited, lockout), sent over SMS.
2. `POST /v1/auth/verify` → register-or-login, bind device, open a session, mint a short-lived
   **access JWT** (carrying DB-resolved roles/perms) + an opaque **refresh token** (only its
   hash is stored).
3. `POST /v1/auth/refresh` → rotates the refresh token (theft-resistant) and re-resolves perms.
4. `POST /v1/auth/logout` (+ `?allDevices`) and `GET/DELETE /v1/auth/sessions` for session mgmt.

## Security properties (the bar)
- **Permissions come from the DB, never the client.** `core/rbac/RoleCacheService` resolves
  effective permissions (role grants ∪ staff GRANT − staff DENY; `super_admin` ⇒ `*`), caches
  them, and is invalidated on every role change — so a token reflects DB truth within its short TTL.
- **OTP**: hashed at rest, single-use, per-phone request rate limit + resend cooldown, verify
  attempt cap → lockout, constant-time compare, enumeration-safe responses.
- **Tokens**: HS256 access (15m) with iss/aud checks; refresh is high-entropy random, stored
  only as a salted hash, rotated each refresh, constant-time compared.
- **Tenant isolation**: `tenant_id` in every query on tenant-scoped tables + RLS (proven in the
  integration test). **Audit**: admin actions (role assign/approve/revoke, KYC review, status
  change, assisted-create) write append-only `audit_log` rows in the same transaction.
- **Mutations are idempotent** (Idempotency-Key required on create POSTs), atomic (UnitOfWork),
  and emit events via the outbox in-tx.

## Endpoints
`/v1/auth/*` · `/v1/users/*` (me + admin) · `/v1/rbac/*` (roles, permissions, assignments,
overrides) · `/v1/kyc/*` · `/v1/addresses/*` · `/v1/bank-accounts/*` · `/v1/consents/*`.

## Tests
Unit: user invariants + status/KYC state machines, OTP security (rate-limit/lockout/single-use),
token mint/verify + refresh hashing, value-object validation, tenant-isolation SQL contract.
Integration (`identity.integration.spec.ts`, real Postgres + RLS): OTP login → token → assign
role → next token carries the perm → refresh rotation → cross-tenant RLS. The integration DB is
built from the REAL `db/migrations` + `db/seeds` (via `test/integration-global-setup.js`); the
spec inserts only its two test tenants.

## Core hardening delivered alongside this module
`core/rbac/role-cache.service`, `core/auth/{token,otp,refresh-token}.service`, `core/audit/*`.
