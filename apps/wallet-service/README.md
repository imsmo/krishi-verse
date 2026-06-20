# wallet-service — the money authority (Law 2)

The standalone service that owns the ledger. It is the **only writer** of `wallet_accounts` + `ledger_*`
(connects as the `kv_wallet` DB role; migration 0014 revokes ledger writes from `kv_app`). Every money movement
is a balanced, double-entry, hash-chained, idempotent transaction. The same contract is served two ways with
identical behaviour:

- **in-process** — `apps/api/src/core/wallet/wallet.client.inprocess.ts` (the active path at shard_count=1);
- **over gRPC** — this service (`src/grpc/wallet.proto` → `wallet.grpc-controller.ts`), the extraction target.

Callers never change when the platform flips from in-process to gRPC (Law 12). The ledger algorithm here mirrors
`core/wallet` byte-for-byte on the invariants + the hash formula, so a ledger written either way verifies the same.

## Guarantees (the ledger engine, `src/ledger/post-transaction.service.ts`)

1. **Zero-sum** — legs must sum to 0 (no money created/destroyed); otherwise hard fail.
2. **Single currency**, ≥2 legs, no zero-amount leg.
3. **Idempotent** — replaying the same `idempotency_key` returns the same txn, never double-posts (Law 3).
4. **Concurrency-safe** — each account locked `FOR UPDATE` in a deterministic id order (no deadlocks);
   `statement_timeout` + `lock_timeout` bound every query so a stuck money op fails loudly, never wedges.
5. **No overdraw** of user/tenant accounts; **frozen** accounts reject debits.
6. **Tamper-evident** — per-account hash chain `entry_hash = sha256(prev ‖ txnId ‖ accountId ‖ amount ‖
   balanceAfter)`.
7. **bigint minor units** end-to-end — never a JS number/float (Law 2). The proto loads with `longs:String`.

## Hot-account striping (`src/accounts/hot-account-striping.ts`)

Platform accounts (escrow/fees/gateway/…) are the hottest rows — a single row would serialize every money post
on one lock. They're striped across N sub-accounts (`shard_no 0..N-1`); a post picks a stripe **deterministically
from the txn's idempotency key** (so a replay lands on the same row → idempotency holds), and a platform balance
is the **sum across stripes**. Double-entry is unaffected (only which platform sub-row moves changes). This
replaces the prior "shard 0 only" placeholder.

## Reconciliation (`src/reconciliation/*`)

Continuous money-safety, recorded in `reconciliation_runs`: `zero_sum_check` (every txn's entries sum to 0) and
`hourly_internal` (each account's cached balance equals Σ of its entries). A non-empty mismatch list is sev-1.
(External gateway↔statement matching stays in the `payments` module, which holds the gateway-side data.)

## gRPC surface (`src/grpc/wallet.proto`)

`PostTransaction(PostTransactionRequest) → PostTransactionResponse` and `GetBalance(BalanceRequest) →
BalanceResponse`. The controller maps proto → engine (inside one wallet tx) and typed `WalletError`s → the right
gRPC status (FAILED_PRECONDITION for overdraw/frozen, INVALID_ARGUMENT for malformed, INTERNAL for a
not-balanced invariant breach — internals never leak).

## Threats considered (§4)

- **Fail closed** — boot refuses production without a `kv_wallet` DB URL / with a default password.
- **No money created/destroyed** — zero-sum enforced before any write; proven at the DB in the integration test.
- **No double-spend / replay** — idempotency key is `UNIQUE`; replay returns the prior txn, no new entries.
- **No overdraw / frozen abuse** — enforced under the per-account `FOR UPDATE` lock.
- **DoS** — bounded statement/lock timeouts; recon row LIMITs; striping spreads lock contention.
- **RLS note** — `wallet_accounts` + `ledger_*` are intentionally OUTSIDE tenant RLS (platform-internal,
  `kv_wallet`-only), so the cross-tenant-RLS gate doesn't apply; isolation is by DB role + the money invariants.

## Tests

`src/test/ledger-invariants.spec.ts` (zero-sum, single-currency, ≥2-legs, no-zero-leg, unknown-txn-type,
idempotent replay, no-overdraw, frozen-debit, hash-chain determinism — in-memory ledger);
`src/test/striping.spec.ts` (deterministic, in-range, well-spread); `src/test/wallet.integration.spec.ts` (real
Postgres: balanced post → idempotent replay → Σ=0 at the DB → reconciliation passes; runs when `DATABASE_URL`
is set). `npm test` runs in-band (the ledger is all bigint → deterministic).

## Build note

The ledger **core** (engine, repo, config, pool, accounts, reconciliation) is framework-free and compiles +
unit-tests with no extra deps (`tsconfig.core.json`). The **gRPC transport** (`src/grpc`, `src/main.ts`) imports
the declared `@grpc/grpc-js` + `@grpc/proto-loader` deps and compiles via the full `tsconfig.json` under CI's
`pnpm install` (this monorepo uses the `workspace:` protocol that plain `npm` can't resolve offline).

## Deferred

Payment-gateway integration (Razorpay/RazorpayX money-in/out) lives in the `payments` module, which calls this
service's `PostTransaction`; the `src/payments` + `src/payouts` scaffolds here are placeholders for a future move
of that integration behind the money authority. mTLS between callers and the gRPC server; balance snapshots for
O(1) audit.
