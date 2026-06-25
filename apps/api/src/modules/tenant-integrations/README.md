# tenant-integrations (tenant self-serve third-party integrations · P1-11)

A tenant admin connects/disconnects its **own** third-party provider credentials (its Razorpay sub-account, MSG91
sender, e-NAM key, …). The platform-wide provider catalogue + god-mode provisioning live in `apps/admin-api`
providers-ops (Law 11); this module is the tenant's self-serve plane.

## Routes (`/v1/integrations`, gated by the `tenancy` flag)
- `GET /providers` — the active provider catalogue a tenant may connect (global `integration_providers`).
- `GET /` — the tenant's own integrations, **masked** (never returns the vault `secretRef`).
- `POST /` (`tenant.settings`, Idempotency-Key) — connect/replace a provider's credentials.
- `DELETE /:providerCode` (`tenant.settings`) — disconnect (deactivate + best-effort vault delete).

## Security
- **Raw credentials are NEVER stored in our DB** (or logged). On connect, the plaintext goes straight to the
  `SecretWriter` port and only the opaque ref (AWS Secrets Manager ARN) is persisted on `tenant_integrations`.
  `serialize()` excludes the ref entirely; the audit records the provider + config but never the secret.
- **SecretWriter** (`core/secrets`): a PORT with two adapters — `AwsSecretWriter` (prod, wrapped in
  core/resilience, AWS SDK loaded lazily as a soft dependency) and `LocalSecretWriter` (dev no-op that discards the
  plaintext — dev must never carry real credentials). The module factory **fails closed**: in production the binding
  MUST be `aws` (env `INTEGRATION_SECRETS_BACKEND=aws`) or boot crashes.
- Tenant isolation: `tenant_id` in every query + RLS (auto-applied in migration 0014). RBAC THROWS
  (`tenant.settings`); this is the tenant's own admin, not god-mode.
- One ACID tx per write; audited (`integration.connected` / `integration.disconnected`) in the same tx.

## Schema
`integration_providers` (global catalogue, seeded in `db/seeds/core/0010_integration_providers.sql`) +
`tenant_integrations` (0002; `secret_ref` holds the vault ARN, `config` holds NON-secret settings). RLS + the
default partition are provided by the automatic procedures in migration 0014 — no new migration was required.
