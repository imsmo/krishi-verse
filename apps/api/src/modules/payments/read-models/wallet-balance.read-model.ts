// modules/payments/read-models/wallet-balance.read-model.ts
// CQRS read of a user's wallet balance (the "withdrawable" figure the payout UI shows). Served from
// the REPLICA, never the primary (Law 12). wallet_accounts is an operational table outside tenant RLS
// (the ledger is the wallet-service's domain), so we scope explicitly by owner_user_id + the caller's
// tenant context AND never expose another user's balance. Platform accounts are striped — for user
// accounts shard_no is always 0, so the single cached_balance_minor row is the balance. Returns minor
// units as a string (bigint-safe); a missing account = zero (the account is created on first credit).
import { Injectable } from '@nestjs/common';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';

export interface WalletBalanceView {
  userId: string;
  currencyCode: string;
  availableMinor: string;   // cached balance of the user's 'main' account
  heldMinor: string;        // cached balance of the user's 'hold' account (reserved, not withdrawable)
  isFrozen: boolean;        // a frozen account cannot be debited (payouts blocked)
}

@Injectable()
export class WalletBalanceReadModel {
  constructor(private readonly pools: PgPoolProvider) {}

  /** The caller's own withdrawable balance. `viewerUserId` MUST equal `userId` unless `canModerate`
   *  (finance/support) — prevents one user reading another's balance (anti-IDOR). */
  async forUser(viewerUserId: string, userId: string, canModerate: boolean, currencyCode = 'INR'): Promise<WalletBalanceView> {
    if (viewerUserId !== userId && !canModerate) {
      // fail closed: never leak another user's balance, never 403-vs-404 distinguish — return zeros.
      return { userId, currencyCode, availableMinor: '0', heldMinor: '0', isFrozen: false };
    }
    const r = await this.pools.replica(0).query<{ account_code: string; cached_balance_minor: string; is_frozen: boolean }>(
      `SELECT account_code, cached_balance_minor::text, is_frozen
         FROM wallet_accounts
        WHERE owner_kind='user' AND owner_user_id=$1 AND currency_code=$2 AND account_code IN ('main','hold')`,
      [userId, currencyCode]);
    const main = r.rows.find((x) => x.account_code === 'main');
    const hold = r.rows.find((x) => x.account_code === 'hold');
    return {
      userId, currencyCode,
      availableMinor: main?.cached_balance_minor ?? '0',
      heldMinor: hold?.cached_balance_minor ?? '0',
      isFrozen: main?.is_frozen === true,
    };
  }
}
