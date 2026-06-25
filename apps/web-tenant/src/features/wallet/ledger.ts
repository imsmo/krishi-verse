// apps/web-tenant/src/features/wallet/ledger.ts · PURE presenters for the wallet ledger statement (no React/IO →
// unit-tested). The server is the source of truth: each ledger entry already carries a SIGNED amount (+credit /
// −debit) and the running balance AFTER that entry (balanceAfterMinor), both bigint minor-unit strings (Law 2).
// The client NEVER computes a balance — it only classifies the sign for display. Comparisons use BigInt, never a
// float. The total-balance figure shown elsewhere is wallet.balance (available + held), also server-truth.
export type LedgerTone = 'credit' | 'debit' | 'zero';

export interface LedgerEntryView {
  /** true when the entry credited the account (amount > 0). */
  isCredit: boolean;
  /** 'credit' | 'debit' | 'zero' — drives the amount colour/sign class. */
  tone: LedgerTone;
  /** The signed amount exactly as the server sent it (kept as a string; Law 2). */
  amountMinor: string;
  /** Running balance of that account after this entry (server-computed; never derived here). */
  balanceAfterMinor: string;
}

/** Classify one signed ledger amount. Falls back to 'zero' for a non-numeric/zero value (degrade-never-die). */
export function ledgerTone(amountMinor: string): LedgerTone {
  let v: bigint;
  try { v = BigInt(amountMinor); } catch { return 'zero'; }
  return v > 0n ? 'credit' : v < 0n ? 'debit' : 'zero';
}

/** Presentational view of a ledger entry. The signed amount + running balance come straight from the server. */
export function presentLedgerEntry(e: { amountMinor: string; balanceAfterMinor: string }): LedgerEntryView {
  const tone = ledgerTone(e.amountMinor);
  return { isCredit: tone === 'credit', tone, amountMinor: e.amountMinor, balanceAfterMinor: e.balanceAfterMinor };
}

/** Available + held = total wallet position (both server-truth bigint-minor strings). Pure BigInt; never a float. */
export function totalWalletMinor(availableMinor: string, heldMinor: string): string {
  let a: bigint, h: bigint;
  try { a = BigInt(availableMinor); } catch { a = 0n; }
  try { h = BigInt(heldMinor); } catch { h = 0n; }
  return (a + h).toString();
}
