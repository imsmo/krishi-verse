# tenant-webhooks (tenant self-serve outbound webhooks · P1-11)

A tenant admin registers https endpoints, subscribes to platform events, and receives a **signing secret once**.
On every relayed outbox event of an allow-listed type, deliveries are fanned out and POSTed — **HMAC-signed** — to
the tenant's endpoints, with retries.

## Routes (`/v1/webhooks`, `tenancy` flag, `tenant.settings`)
- `GET /events` — the event allow-list (`webhook-events.ts`).
- `GET /` — the tenant's endpoints, **masked** (no secret).
- `POST /` — register (SSRF-guarded URL + event allow-list); returns the signing `secret` **once**.
- `PATCH /:id` — change event subscriptions / active flag.
- `POST /:id/rotate-secret` — new signing secret, returned **once**.
- `DELETE /:id` — remove.

## Security
- **SSRF guard** (`webhook-ssrf.ts`, pure + tested): only public **https** is accepted — localhost/.local/.internal,
  the cloud metadata host, credentials-in-URL, odd ports, and every private/loopback/link-local/ULA IP literal (v4 +
  v6) are rejected at registration. DNS-rebinding is a documented residual handled by egress controls + the worker's
  hard timeout. The worker re-checks https defensively before each request.
- **Signing secret at rest**: generated server-side, shown to the tenant ONCE, persisted **AES-256-GCM-encrypted**
  (`core/crypto/secret-box`, key `WEBHOOK_SIGNING_KEK` — fail-closed in prod). `serialize()` never returns it. This is
  reversible-by-design (unlike a password hash) because the platform must reproduce the HMAC on every delivery.
- **Signature**: header `X-KV-Signature: t=<unix>,v1=<hmac-sha256 of "t.body">` + `X-KV-Timestamp` (replay defence),
  `webhook-signature.ts` (pure + tested).
- Tenant isolation: `tenant_id` in every query + RLS (0014 auto). RBAC THROWS (`tenant.settings`) — not god-mode.
  One ACID tx per write; audited (`webhook.registered/updated/secret_rotated/deleted`, never the secret).

## Delivery (apps/worker, pg-native)
`webhook-delivery.job` runs under the worker leader-lock: picks due `webhook_deliveries` (enqueued IN-TX by the
`WebhookFanoutHandler` on relayed events), decrypts the endpoint secret, signs, POSTs with an 8s timeout, and on
failure schedules exponential backoff (1m→4h) up to 8 attempts, then parks the row (`next_retry_at = NULL`). Metrics:
`kv_webhook_delivered`, `kv_webhook_delivery_failures`, `kv_webhook_delivery_disabled`.

## Schema
`webhook_endpoints` (`secret_hash` repurposed to hold the AES-GCM ciphertext) + partitioned `webhook_deliveries`
(0002). RLS + partitions are provided by the automatic procedures in migration 0014 — no new migration was required.
