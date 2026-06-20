// apps/wallet-service/src/accounts/balance.service.ts · read an account's balance (minor units). Platform
// accounts sum across their stripes. A read runs in its own short tx so it sees a committed, consistent value.
import { WalletPool } from '../core/database/pg-pool.provider';
import { PostTransactionService } from '../ledger/post-transaction.service';
import { AccountRef } from '../ledger/account-codes';

export class BalanceService {
  constructor(private readonly pool: WalletPool, private readonly engine: PostTransactionService) {}
  async balanceMinor(account: AccountRef): Promise<bigint> {
    return this.pool.withTx((tx) => this.engine.balanceMinor(tx, account));
  }
}
