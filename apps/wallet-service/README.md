# wallet-service — the only process allowed to write money

The wallet service owns `wallet_accounts` + `ledger_*` and is the ONLY writer of money (Law 2).
It connects as the least-privilege `kv_wallet` role; DB grants enforce the boundary even if app
code forgets (migration 0014 revokes ledger writes from `kv_app`).

## Where the implementation lives right now (important)

You chose **"own app + in-process client"** for this stage. To avoid two drift-prone copies of the
money algorithm, the **authoritative ledger logic lives once** in
`apps/api/src/core/wallet/` and is bound in-process via the `WALLET_SERVICE` token:

- `wallet.port.ts` — the contract (mirrors `src/grpc/wallet.proto`).
- `ledger.repository.ts` — all `wallet_accounts` / `ledger_*` SQL (account lock, balanced entries,
  hash chain, idempotent txn header).
- `wallet.client.inprocess.ts` — the in-process implementation: zero-sum enforcement, idempotency,
  per-account `FOR UPDATE` locking, no-overdraw, frozen-account rejection, per-account hash chain.

At `shard_count=1` this in-process client IS the wallet service. **No money code is duplicated
here** — that is deliberate.

## What this app becomes (the extraction step)

`src/grpc/wallet.proto` is the real contract. When the wallet is extracted to its own process
(Phase 3 scale trigger), this app hosts a gRPC server that wraps the *same* `core/wallet` algorithm,
and `CoreModule` swaps the in-process binding for a network gRPC client — **callers do not change**.

## Next wave (flagged, not faked) — needed before high-volume launch
- **Hot-account striping** (`shard_no` 0..15 for platform escrow/fees) to remove single-row lock
  contention; the schema column + unique index already exist. Today: shard 0.
- **Reconciliation jobs** (`hourly_internal`, `daily_gateway`, `zero_sum_check` → `reconciliation_runs`).
- **Payout execution** (RazorpayX) + failure-reversal.
- **gRPC server bootstrap** + `kv_wallet` connection.

These are real future work, not stubs masquerading as done; the active money path
(`core/wallet` + the payments module) is fully implemented and tested.
