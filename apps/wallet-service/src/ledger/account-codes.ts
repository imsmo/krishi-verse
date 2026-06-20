// apps/wallet-service/src/ledger/account-codes.ts · the fixed chart of accounts (account_code values from
// db/migrations/0006_money.sql) + the account reference shape. Mirrors apps/api/src/core/wallet/account-codes.ts
// so the in-process port and this service speak the SAME accounts. Money never appears/disappears — it MOVES.
export type WalletOwnerKind = 'user' | 'tenant' | 'platform';

export interface AccountRef {
  kind: WalletOwnerKind;
  userId?: string;        // required when kind='user'
  tenantId?: string;      // required when kind='tenant'
  accountCode: string;    // main|hold|commission|escrow|fees|gateway|payouts|gst_payable|tds_payable|…
  currencyCode?: string;  // default 'INR'
}
export const DEFAULT_CURRENCY = 'INR';
export const PLATFORM_ACCOUNT_CODES = new Set(['escrow', 'fees', 'gateway', 'payouts', 'gst_payable', 'tds_payable', 'promo_liability', 'suspense']);
