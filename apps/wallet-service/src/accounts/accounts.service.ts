// apps/wallet-service/src/accounts/accounts.service.ts · account administration: freeze / unfreeze a wallet
// account (fraud hold / legal). A frozen account rejects debits in the engine. Freezing is a privileged op
// (the caller — admin-api / fraud ops — is authorized BEFORE reaching the service); we lock the row in a tx so
// the flag flip is atomic with any concurrent post.
import { WalletPool } from '../core/database/pg-pool.provider';
import { LedgerRepository } from '../ledger/ledger.repository';
import { AccountRef, DEFAULT_CURRENCY } from '../ledger/account-codes';
import { InvalidLedgerTxnError } from '../ledger/wallet.errors';

export class AccountsService {
  constructor(private readonly pool: WalletPool, private readonly ledger: LedgerRepository) {}

  /** Freeze/unfreeze a user or tenant account (platform accounts are not freezable — they're internal). */
  async setFrozen(account: AccountRef, frozen: boolean): Promise<void> {
    if (account.kind === 'platform') throw new InvalidLedgerTxnError('platform accounts cannot be frozen');
    const cur = account.currencyCode ?? DEFAULT_CURRENCY;
    await this.pool.withTx(async (tx) => {
      const id = account.kind === 'user'
        ? await this.ledger.ensureUserAccountId(tx, account.userId!, account.accountCode, cur)
        : await this.ledger.ensureTenantAccountId(tx, account.tenantId!, account.accountCode, cur);
      await this.ledger.lockAccount(tx, id);   // serialize with concurrent posts
      await this.ledger.setFrozen(tx, id, frozen);
    });
  }
}
