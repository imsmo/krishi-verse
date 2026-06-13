# wallet-service — the only process allowed to write money
Connects as kv_wallet. Exposes gRPC: PostTransaction (entries must sum to 0),
GetBalance, HoldEMD/Release, QueuePayout. Implements hash-chain, hot-account
striping (shard_no), hourly reconciliation, gateway recon. NOBODY else touches
wallet_accounts/ledger_* — DB grants enforce it even if code forgets.
