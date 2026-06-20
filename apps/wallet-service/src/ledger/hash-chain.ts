// apps/wallet-service/src/ledger/hash-chain.ts · per-account tamper-evident chain. IDENTICAL formula to
// apps/api/src/core/wallet (entry_hash = sha256(prev ‖ txnId ‖ accountId ‖ amount ‖ balanceAfter)) so a ledger
// written in-process and one written by this service verify the same way. Any altered/inserted/removed entry
// breaks every subsequent hash for that account.
import { createHash } from 'node:crypto';

export function entryHash(prev: string | null, txnId: string, accountId: string, amountMinor: bigint, balanceAfterMinor: bigint): string {
  return createHash('sha256').update(`${prev ?? ''}|${txnId}|${accountId}|${amountMinor}|${balanceAfterMinor}`).digest('hex');
}
