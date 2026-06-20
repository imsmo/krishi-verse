// apps/wallet-service/src/ledger/post-transaction.service.ts · the ledger ENGINE — the heart of the money
// service. Behaviour is IDENTICAL to apps/api/src/core/wallet/wallet.client.inprocess.ts (so in-process and
// over-gRPC posts are interchangeable), with platform hot-account striping added. Guarantees, in order:
//   1. ZERO-SUM: legs must sum to 0 (no money created/destroyed) — hard fail.
//   2. SINGLE CURRENCY per txn; ≥2 legs; no zero-amount leg.
//   3. IDEMPOTENT: same idempotency_key ⇒ same txn, never double-posted (Law 3).
//   4. CONCURRENCY-SAFE: each account locked FOR UPDATE, in a deterministic id order (no deadlocks).
//   5. NO OVERDRAW of user/tenant accounts; frozen accounts reject debits.
//   6. TAMPER-EVIDENT: per-account hash chain (prev_hash → entry_hash).
import { Tx } from '../core/database/pg-pool.provider';
import { WalletConfig } from '../core/config/wallet-config';
import { LedgerRepository } from './ledger.repository';
import { TxnTypeRegistry } from './txn-types.registry';
import { entryHash } from './hash-chain';
import { AccountRef, DEFAULT_CURRENCY } from './account-codes';
import { platformStripe } from '../accounts/hot-account-striping';
import { LedgerNotBalancedError, InvalidLedgerTxnError, UnknownTxnTypeError, InsufficientWalletBalanceError, WalletFrozenError } from './wallet.errors';

export interface LedgerLeg { account: AccountRef; amountMinor: bigint; }
export interface PostTxnInput {
  tenantId: string | null; txnType: string; idempotencyKey: string; legs: LedgerLeg[];
  referenceType?: string | null; referenceId?: string | null; initiatedBy?: string | null; description?: string | null;
}
export interface PostTxnResult { txnId: string; alreadyApplied: boolean; }

export class PostTransactionService {
  constructor(private readonly config: WalletConfig, private readonly ledger: LedgerRepository, private readonly txnTypes: TxnTypeRegistry) {}

  async post(tx: Tx, input: PostTxnInput): Promise<PostTxnResult> {
    this.validate(input);

    const txnTypeId = await this.txnTypes.resolve(tx, input.txnType);
    if (!txnTypeId) throw new UnknownTxnTypeError(input.txnType);

    const claim = await this.ledger.insertTxnIdempotent(tx, {
      txnTypeId, tenantId: input.tenantId, idempotencyKey: input.idempotencyKey,
      referenceType: input.referenceType, referenceId: input.referenceId, initiatedBy: input.initiatedBy, description: input.description,
    });
    if (claim.replayed) return { txnId: claim.id, alreadyApplied: true };   // idempotent no-op

    const resolved = await Promise.all(input.legs.map(async (leg) => ({ leg, accountId: await this.resolveAccountId(tx, leg.account, input.idempotencyKey) })));
    resolved.sort((a, b) => (a.accountId < b.accountId ? -1 : 1));          // deterministic lock order → no deadlock

    const currency = input.legs[0].account.currencyCode ?? DEFAULT_CURRENCY;
    for (const { leg, accountId } of resolved) {
      const acct = await this.ledger.lockAccount(tx, accountId);
      const balanceAfter = acct.balanceMinor + leg.amountMinor;
      if (leg.amountMinor < 0n && acct.isFrozen) throw new WalletFrozenError(leg.account.accountCode);
      if (balanceAfter < 0n && acct.kind !== 'platform') throw new InsufficientWalletBalanceError(leg.account.accountCode);
      const hash = entryHash(acct.lastHash, claim.id, accountId, leg.amountMinor, balanceAfter);
      await this.ledger.appendEntry(tx, { txnId: claim.id, accountId, tenantId: input.tenantId, amountMinor: leg.amountMinor, currencyCode: currency, balanceAfter, prevHash: acct.lastHash, entryHash: hash });
    }
    return { txnId: claim.id, alreadyApplied: false };
  }

  async balanceMinor(tx: Tx, account: AccountRef): Promise<bigint> {
    const cur = account.currencyCode ?? DEFAULT_CURRENCY;
    if (account.kind === 'platform') return this.ledger.platformBalance(tx, account.accountCode, cur);
    const id = await this.resolveAccountId(tx, account, 'balance-read');
    return this.ledger.balanceOf(tx, id);
  }

  /** Resolve (get-or-create) the account row id. Platform legs are striped deterministically from the txn key. */
  private async resolveAccountId(tx: Tx, a: AccountRef, idempotencyKey: string): Promise<string> {
    const cur = a.currencyCode ?? DEFAULT_CURRENCY;
    if (a.kind === 'user') { if (!a.userId) throw new InvalidLedgerTxnError('user leg requires userId'); return this.ledger.ensureUserAccountId(tx, a.userId, a.accountCode, cur); }
    if (a.kind === 'tenant') { if (!a.tenantId) throw new InvalidLedgerTxnError('tenant leg requires tenantId'); return this.ledger.ensureTenantAccountId(tx, a.tenantId, a.accountCode, cur); }
    const shard = platformStripe(idempotencyKey, a.accountCode, this.config.env.PLATFORM_STRIPE_COUNT);
    return this.ledger.ensurePlatformAccountId(tx, a.accountCode, cur, shard);
  }

  private validate(input: PostTxnInput): void {
    if (!input.idempotencyKey) throw new InvalidLedgerTxnError('idempotencyKey is required (Law 3)');
    if (!input.txnType) throw new InvalidLedgerTxnError('txnType is required');
    if (input.legs.length < 2) throw new InvalidLedgerTxnError('a transaction needs at least 2 legs');
    const currencies = new Set(input.legs.map((l) => l.account.currencyCode ?? DEFAULT_CURRENCY));
    if (currencies.size > 1) throw new InvalidLedgerTxnError('all legs must share one currency');
    let sum = 0n;
    for (const l of input.legs) {
      if (l.amountMinor === 0n) throw new InvalidLedgerTxnError('a leg amount cannot be zero');
      sum += l.amountMinor;
    }
    if (sum !== 0n) throw new LedgerNotBalancedError(sum);
  }
}
