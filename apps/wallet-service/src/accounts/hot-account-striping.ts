// apps/wallet-service/src/accounts/hot-account-striping.ts · platform accounts (escrow/fees/gateway/…) are the
// hottest rows on the platform — every order touches them, so a single row would serialize all money posts on
// one FOR UPDATE lock. Striping spreads each platform account across N sub-accounts (shard_no 0..N-1); a post
// picks a stripe DETERMINISTICALLY from the txn's idempotency key (so a replay always lands on the SAME stripe →
// idempotency holds), and a balance is the SUM across stripes. The double-entry invariant is unaffected: the
// txn's other legs are unchanged; only WHICH platform sub-row is credited/debited moves.
import { createHash } from 'node:crypto';

/** Deterministic stripe in [0, stripeCount) for a platform leg of this transaction. */
export function platformStripe(idempotencyKey: string, accountCode: string, stripeCount: number): number {
  if (stripeCount <= 1) return 0;
  const h = createHash('sha256').update(`${idempotencyKey}|${accountCode}`).digest();
  // first 4 bytes → unsigned int → modulo. Even distribution across stripes.
  const n = h.readUInt32BE(0);
  return n % stripeCount;
}
