# recon-monitor (admin-api · god-mode plane, Law 11 + Law 9)

The platform **money-safety** ops module — the plane closest to the ledger. It gives platform staff a
read-only **wallet reconciliation dashboard**, a **mismatch-investigation** workflow over reconciliation
alarms, and the emergency **account-freeze** control. It does **NOT** post to the ledger: money moves only via
the wallet-service (Law 2). A freeze flips `wallet_accounts.is_frozen` — the guard the wallet engine honours to
reject further debits — and moves **no** money (zero-sum untouched).

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/recon/overview` | `recon.read` | — (latest run per type + ledger **zero-sum health**) |
| GET | `/v1/recon/runs` · `/runs/:id` | `recon.read` | — (keyset list + single run w/ mismatches) |
| GET | `/v1/recon/accounts/:id` | `recon.read` | — (balance as **string** minor units + frozen state) |
| GET | `/v1/recon/investigations` · `/:id` | `recon.read` | — (keyset list + detail) |
| POST | `/v1/recon/investigations` | `recon.manage` | **FIDO2 + step-up** (open) |
| PATCH | `/v1/recon/investigations/:id` | `recon.manage` | **FIDO2 + step-up** (start/resolve/false_positive) |
| POST | `/v1/recon/accounts/:id/freeze` | `recon.manage` | **FIDO2 + step-up** (freeze/unfreeze) |

## What it owns
- The investigation state machine (`open→investigating→resolved\|false_positive`, Law 5) over a
  `reconciliation_run` mismatch; a partial-unique index enforces **one open investigation per run** (alert-storm
  dedup, §4). Each mutation runs in ONE ACID tx: state-machine transition → `UPDATE recon_investigations` →
  `audit_log` row — atomic.
- The account-freeze control: lock `wallet_accounts FOR UPDATE` → `applyFreeze` guard (no-op rejected 409) → set
  `is_frozen` + `freeze_reason` → append `account_freeze_orders` history → `audit_log` row — all in one tx, **no
  ledger write**. (Migration 0033: `recon_investigations`, `account_freeze_orders`.)
- A read-only dashboard: latest run per `run_type`, ledger **zero-sum** check (`SUM(ledger_entries.amount_minor)`
  must be `0` — the double-entry invariant; non-zero = money-safety alarm), and account balances as strings.

## Threats considered (§4 + Law 9)
- **Never moves money.** This module has NO ledger-write path — the repository exposes only recon/wallet reads
  and the `is_frozen` flag flip. Unit-tested: the freeze path posts no ledger entry; the integration test asserts
  `ledger_entries` count is unchanged across freeze→unfreeze.
- **No privilege escalation (Law 11).** `recon.manage`/`recon.read` are PLATFORM owner perms (roles
  `platform_recon_ops`/`platform_recon_viewer`); never resolvable by a tenant role, and a recon role doesn't bleed
  into other planes (unit-tested).
- **JIT elevation + audit.** Every mutation needs a verified admin JWT + the owner perm + FIDO2 hardware-key +
  step-up; guards THROW. Every state change + freeze writes an `audit_log` row IN THE SAME TX (actor, old→new,
  reason, ip, request_id); a rejected transition/no-op freeze writes nothing.
- **Fail closed / bounded.** Illegal investigation transitions and double-freeze/redundant-unfreeze throw typed
  4xx before any write; missing run/account/investigation → 404. Keyset pagination (never OFFSET), max LIMIT 100,
  parameterised SQL only, mandatory reason. Money is bigint surfaced as **string** minor units — never floated.

## Tests
- Unit (`recon-monitor.spec.ts`): investigation state machine, entity, freeze guards (incl. no-ledger assertion),
  owner-RBAC + no-escalation, DTO validation, services audit-in-tx + 404 + illegal-transition.
- Integration (`recon-monitor.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): open
  investigation (+dedup) on a seeded run; freeze→unfreeze a seeded wallet account asserting `is_frozen`,
  `account_freeze_orders`, `audit_log`, and **zero new `ledger_entries`**.
