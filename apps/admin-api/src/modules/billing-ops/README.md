# billing-ops (admin-api · god-mode plane, Law 11 + Law 2/9)

The platform **SaaS-billing** ops module. It gives platform billing/finance staff the controls over the SaaS
revenue stream (plans → subscriptions → `saas_invoices` from migration 0002): a **SaaS-invoice admin** (status
transitions), **dunning** (payment-failure follow-up), a read-only **revenue dashboard** (MRR/ARR/receivables),
and **manual money adjustments** (goodwill credits / clawback debits). It owns the DECISIONS; **money moves ONLY
via the wallet-service** (Law 2/9) — this module never writes the ledger.

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/billing/revenue` | `billing.read` | — (MRR/ARR/outstanding/collected) |
| GET | `/v1/billing/invoices` · `/invoices/:id` | `billing.read` | — (keyset list + detail) |
| PATCH | `/v1/billing/invoices/:id` | `billing.manage` | **FIDO2 + step-up** (issue/mark_overdue/void) |
| GET | `/v1/billing/invoices/:id/dunning` | `billing.read` | — (keyset list) |
| POST | `/v1/billing/invoices/:id/dunning` | `billing.manage` | **FIDO2 + step-up** (record a dunning touch) |
| GET | `/v1/billing/adjustments` | `billing.read` | — (keyset list) |
| POST | `/v1/billing/adjustments` | `billing.manage` | **FIDO2 + step-up** (manual money adjustment → wallet-service) |

## What it owns
- **SaaS-invoice admin** over `saas_invoices` (0002): state machine `draft→issued→paid\|partially_paid→overdue→void`
  (Law 5). Only `issue` / `mark_overdue` / `void` are admin-settable — `paid`/`partially_paid` arrive from payment
  reconciliation, never a manual mark. Each transition is one ACID tx + an audit row.
- **Dunning** over `saas_invoice_dunning_attempts` (0035): an append-only history of follow-up touches
  (email/sms/whatsapp/call/in_app + outcome) on an unpaid invoice. The invoice is locked `FOR UPDATE` so attempts
  serialise; the domain caps total attempts (abuse/DoS guard). Bumps a denormalised `dunning_attempts` counter.
- **Revenue dashboard** (read-only): MRR (active subscriptions normalised to monthly — **annual ÷ 12 via integer
  division, never a float**), ARR = MRR × 12, outstanding receivables, collected-in-window, invoice counts by
  status. All money is bigint minor units surfaced as strings.
- **Manual adjustments** over `billing_adjustments` (0035): a goodwill **credit** moves value platform → tenant
  (`+tenant.main` / `−platform.promo_liability`); a **debit** is the mirror (clawback). The two signed legs sum to
  ZERO and are posted by the **wallet-service** over gRPC (`ledger_txn_type='billing_adjustment'`). The row records
  the resulting `wallet_txn_id` + the idempotency key; this module never touches `ledger_*`/`wallet_accounts`.

## Money path (Law 2/9 — how a manual adjustment is applied)
admin-api is a separate process/realm, so it calls the **wallet-service** (the platform's ONLY money writer) over
its gRPC contract via the `WALLET_ADMIN` port (`core/wallet/wallet-grpc.client.ts`). The flow is idempotent and
degrade-never-die: validate (bigint, capped) → 404 if tenant unknown → idempotent replay check → `wallet.post`
with a stable per-`(tenant, key)` idempotency key (replay there is a no-op) → record `billing_adjustments` + audit
in ONE admin tx. A wallet failure writes an audit `failed` entry and returns a typed 502 with **no** local row, so
a retry is clean. Fail-closed: if `WALLET_GRPC_ADDR` is unset the client refuses to move money (throws).

## Threats considered (§4 + money safety)
- **Money only via the wallet-service (Law 2/9).** No ledger/wallet write path exists in this module; the
  repository touches only `saas_invoices` / `billing_adjustments` / `saas_invoice_dunning_attempts` /
  `subscriptions`. Amounts are **bigint minor units** end to end (zod string → bigint), never a JS float; the
  adjustment legs are asserted zero-sum (unit-tested).
- **No privilege escalation (Law 11).** `billing.manage`/`billing.read` are PLATFORM owner perms (roles
  `platform_billing_ops` / `platform_billing_viewer`); never tenant-assignable, no plane bleed (unit-tested).
- **JIT elevation + audit.** Every mutation needs a verified admin JWT + the owner perm + FIDO2 hardware-key +
  step-up; guards THROW. Each invoice/dunning/adjustment write commits an `audit_log` row IN THE SAME TX
  (actor, old→new, reason, ip, request_id); illegal transitions / failed adjustments write no business row.
- **Idempotency + replay safety.** Adjustments are idempotent per `(tenant, key)` at both the admin record
  (UNIQUE `idempotency_key`) and the wallet post — a replay never double-moves money.
- **Tenant isolation.** `billing_adjustments` + `saas_invoice_dunning_attempts` carry `tenant_id` with FORCE RLS
  (defence-in-depth; kv_admin bypasses but every action is audited). Reads accept an optional `tenantId` filter.
- **Fail closed / bounded.** Typed 404s on missing invoice/tenant; per-adjustment cap; dunning attempt cap; zod
  `.strict()` DTOs reject unknown keys / floats / negatives; parameterised SQL only; keyset pagination (never
  OFFSET), max LIMIT 100; wallet RPC carries a hard deadline; mandatory reason on every mutation.

## Tests
- Unit (`billing-ops.spec.ts`): invoice state machine + entity; dunning rules + cap; adjustment money domain
  (positive/capped, balanced zero-sum bigint legs); float-free revenue math; owner-RBAC + no-escalation; DTO
  validation (incl. float/negative rejection); services proving audit-in-tx, enforced state machine, 404s,
  money-only-via-wallet, idempotent replay, and no-row-on-wallet-failure.
- Integration (`billing-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): work an invoice
  draft→issued→overdue + a dunning attempt (counter + audit rows); apply a manual adjustment (record + audit +
  idempotent replay via a fake wallet port — the gRPC server isn't booted in this suite).
