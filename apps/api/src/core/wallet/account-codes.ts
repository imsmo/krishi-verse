// core/wallet/account-codes.ts · the fixed chart of accounts (account_code values from
// db/migrations/0006_money.sql). Money never appears or disappears — it MOVES between these.
export const UserAccount = { Main: 'main', Hold: 'hold' } as const;
export const TenantAccount = { Main: 'main', Commission: 'commission', Hold: 'hold' } as const;
export const PlatformAccount = {
  Escrow: 'escrow', Fees: 'fees', Gateway: 'gateway', Payouts: 'payouts',
  GstPayable: 'gst_payable', TdsPayable: 'tds_payable', PromoLiability: 'promo_liability', Suspense: 'suspense',
} as const;

export type WalletOwnerKind = 'user' | 'tenant' | 'platform';

/** A stable reference to a wallet account, resolved/created on first use. */
export interface AccountRef {
  kind: WalletOwnerKind;
  userId?: string;        // required when kind='user'
  tenantId?: string;      // required when kind='tenant'
  accountCode: string;    // one of the *Account codes above
  currencyCode?: string;  // default 'INR'
}

export const userMain = (userId: string, currencyCode = 'INR'): AccountRef => ({ kind: 'user', userId, accountCode: UserAccount.Main, currencyCode });
export const userHold = (userId: string, currencyCode = 'INR'): AccountRef => ({ kind: 'user', userId, accountCode: UserAccount.Hold, currencyCode });
export const tenantCommission = (tenantId: string, currencyCode = 'INR'): AccountRef => ({ kind: 'tenant', tenantId, accountCode: TenantAccount.Commission, currencyCode });
export const platform = (accountCode: string, currencyCode = 'INR'): AccountRef => ({ kind: 'platform', accountCode, currencyCode });
