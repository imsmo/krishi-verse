// apps/wallet-service/src/wallet.module.ts · the composition root (plain factory — the money core is framework-
// free so it stays dependency-light + trivially testable). Wires config → pool → repo → txn-type registry →
// engine → balance/accounts/reconciliation. main.ts attaches the gRPC transport on top.
import { WalletConfig } from './core/config/wallet-config';
import { WalletPool } from './core/database/pg-pool.provider';
import { LedgerRepository } from './ledger/ledger.repository';
import { TxnTypeRegistry } from './ledger/txn-types.registry';
import { PostTransactionService } from './ledger/post-transaction.service';
import { BalanceService } from './accounts/balance.service';
import { AccountsService } from './accounts/accounts.service';
import { ReconciliationService } from './reconciliation/reconciliation.service';

export interface WalletService {
  config: WalletConfig; pool: WalletPool; engine: PostTransactionService;
  balances: BalanceService; accounts: AccountsService; reconciliation: ReconciliationService;
}

export function buildWalletService(raw: Record<string, unknown> = process.env): WalletService {
  const config = new WalletConfig(raw);
  const pool = new WalletPool(config);
  const ledger = new LedgerRepository();
  const engine = new PostTransactionService(config, ledger, new TxnTypeRegistry());
  return {
    config, pool, engine,
    balances: new BalanceService(pool, engine),
    accounts: new AccountsService(pool, ledger),
    reconciliation: new ReconciliationService(),
  };
}
