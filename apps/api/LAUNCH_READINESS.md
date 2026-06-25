# apps/api — Launch / Go-Live Readiness

Operational checklist for shipping the **API-W1…W12 client-un-flag waves** (the post-GA fast-follows that turn the
mobile/web "coming soon" surfaces live). Nothing here blocks the existing green status; this is the sequence to take
the new backend capability to production safely. Every endpoint is server-authoritative (RLS + RBAC + flag),
money-safe (bigint minor units, ledger + outbox — Law 11), idempotent, keyset-paginated, and PII-minimal (DPDP).

---

## 0. Verification gate (must be GREEN in CI before deploy)

| Gate | Local result | Notes |
|------|--------------|-------|
| `npm run build` (tsc, exit 0) | ✅ 0 errors | full apps/api typecheck clean (caught + fixed an API-W8 brace bug) |
| Unit suite (jest) | ✅ 44/44 in the API-W specs | labour-w8, ambassadors-w9, broadcast-state, analytics-window, market-names, privacy-changephone |
| SQL parse (migrations) | ✅ 48 files | the 2 "imbalance" flags are crude-checker artifacts (parens in `--` comments / nested `END LOOP`) |
| Integration (real Postgres, RLS) | ▶ CI job | runs on the CI DB; offline gate = static audit + node-port + SQL parse |
| e2e (HTTP-through-app) | ▶ CI job | identity/catalogue/orders/payments/auctions + smoke |
| Security self-audit (§4) | ✅ no gaps | guards + RLS + idempotency + owner-from-token + no-float-money confirmed across all new endpoints |

---

## 1. Migrations — apply in order (additive, reversible)

The four new migrations from this backlog, applied by `db/scripts/migrate.js` (each wrapped in one tx, recorded in
`schema_migrations`):

1. **0045_push_devices** — `push_devices` (user-scoped; UNIQUE(token) upsert).
2. **0046_labour_applied_status** — `ALTER TYPE booking_status ADD VALUE 'applied'` (additive, NOT used in its own
   tx — Postgres safe).
3. **0047_ambassador_visits_targets** — `ambassador_visits` + `ambassador_targets` (+ RLS re-run pass).
4. **0048_tenant_broadcasts** — `tenant_broadcasts` (+ RLS re-run) + seeds the `tenant.broadcast` notification event
   + push/inapp templates.

API-W4/W5/W6/W7/W10-analytics/W11/W12 added **no migrations** (reads/joins over existing tables, or seed-only).
After 0048, run the standard **`ensure-partitions`** job so the partitioned tables (attendance_records, etc.) have
runway, then re-run **seeds** (idempotent `ON CONFLICT DO NOTHING`).

---

## 2. Feature-flag enable sequence (all default OFF — flip per tenant when the client un-flag ships)

The new endpoints are gated by these existing module flags (no new flags introduced):

- `labour` — worker self-apply, skills, attendance, lookups (M-W8)
- `ambassadors` — assisted-onboarding, visit-log, leaderboard, targets (M-W9)
- `tenancy` — tenant analytics (M-W10)
- `communication` — push-device registration (M-W3) + tenant broadcast (M-W10)
- `market_intel` — commodity/grade name-join on pulse/prices (M-W11)

Core self-service surfaces ship **with no flag** (correct — they are baseline rights/utilities): wallet
balance/ledger, KYC doc-types, buyer saves + saved-searches + **tip wishlist**, checkout preview + pay-from-wallet,
listing boost-tiers/analytics, auctions my-bids, **DPDP privacy** export/deletion/requests, **change-phone**.

**Order:** enable a module flag for a pilot tenant → ship the matching client un-flag (delete the "coming soon") →
watch metrics → widen rollout. Flags are DB-backed with kill-switch + percentage rollout.

---

## 3. Env / secrets to confirm present

- `DATABASE_URL` + `READ_REPLICA_URL` (replica drives all read-models); `MIGRATION_DATABASE_URL` (DDL role).
- `OBJECT_STORE` creds (presigned listing-gallery URLs — API-W5).
- Wallet-service reachable (pay-from-wallet, boost debit — Law 11).
- `SMS_SENDER` provider creds (change-phone OTP, API-W12) + the notifier gateway (broadcast fan-out).
- `auth.exposeOtp = false` in production (dev-only OTP echo).

---

## 4. Smoke tests after deploy (per enabled flag)

- Wallet: `GET wallet/v1/balance` returns reconciled minor-unit strings for the caller only.
- Labour: worker `POST labour/bookings/:id/apply` (Idempotency-Key) → `applied`; `POST .../attendance` rejects a
  fix >100 m from the farm (422).
- Ambassador: `POST ambassadors/assisted-onboarding` with a granted consent creates the farmer + signed_up referral;
  missing consent → 422.
- Tenant: `GET tenancy/analytics` returns the caller-tenant's GMV/orders only (never cross-tenant).
- Broadcast: `POST communication/broadcasts` → 'queued', then the fan-out marks it 'sent' (check delivery log).
- DPDP: `POST privacy/deletion-requests` twice → same open request (idempotent); cooling_ends_at ≈ now+90d.
- Change-phone: start → SMS to the new number; confirm with the code swaps `users.phone` (masked in the event).

---

## 5. Rollback triggers

- Any money path (pay-from-wallet, boost debit, wage settlement) showing a non-zero-sum ledger entry → **kill the
  module flag** (stops new writes; the ledger itself is append-only + reconciled by the recon job).
- Broadcast fan-out saturating the notifier → kill `communication` flag (queued rows are safe; re-run later).
- A migration that fails mid-apply rolls back its own tx (runner wraps each file); fix-forward with the next number,
  never edit an applied migration.

---

## 6. Still FLAGGED (intentionally deferred — external/contract dependencies, never faked)

- **Aadhaar-eKYC** start/OTP — needs a UIDAI/DigiLocker provider contract (API-W2).
- **Geocoded weather forecast** — needs an IMD/provider integration; weather stays regional advisories (API-W11).
- **Farmer AI assistant** (`POST ai/assistant/messages`) — needs the ai-services governed-inference s2s +
  prompt-injection guardrails + cost/rate control (API-W12).
- **Dedicated cross-entity search** (`GET search`) — needs the OpenSearch index plane; mobile keeps its honest
  client-side fan-out (API-W12).
- **Per-impression listing "views"** — needs the high-volume event pipeline (API-W4 analytics).

## 7. Scale-triggered infra (NOT started — by design; build when the trigger fires)

- **backpressure** (app-wide load-shedder / priority / concurrency) — *before first big load*. Partial today:
  rate-limit guard + resilience bulkhead/timeout/breaker + the realtime-gateway backpressure policy.
- **sharding execution** (pool-mgr / directory / cross-shard) — *Phase 3* (shard-router abstraction already exists).
- **cells** (per-country) — *Phase 4* (multi-country data residency).
