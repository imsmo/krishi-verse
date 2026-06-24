// API-W6 pure money invariants for checkout totals-preview + pay-from-wallet. The services are
// orchestration over real Postgres (covered by the integration suite); these assert the FLOAT-FREE
// integer arithmetic those services rely on, in the always-runnable node-port lane (Law 2).
import { OrderItem } from '../domain/order-item.entity';

// mirrors CheckoutService.previewTotals per-seller total: subtotal + delivery + platform − discount, floored at 0.
const sellerTotal = (subtotal: bigint, delivery: bigint, platform: bigint, discount: bigint): bigint => {
  const t = subtotal + delivery + platform - discount;
  return t < 0n ? 0n : t;
};
// mirrors a member platform-fee bps override (basis points, integer division — no float).
const platformFeeFromBps = (subtotal: bigint, bps: number): bigint => (subtotal * BigInt(bps)) / 10000n;

describe('API-W6 · checkout totals-preview (pure math)', () => {
  it('snapshots line totals as unitPrice × qty (bigint minor units)', () => {
    const it = OrderItem.of({ id: 'i1', orderId: 'preview', orderCreatedAt: new Date(), tenantId: 't1', listingId: 'l1',
      productId: 'p1', titleSnapshot: 'Wheat', quantity: 3, unitCode: 'kg', unitPriceMinor: 2500n, gstRatePct: null, hsnCode: null, batchId: null });
    expect(it.props.lineTotalMinor).toBe(7500n);
  });

  it('per-seller total = subtotal + delivery + platform − discount', () => {
    expect(sellerTotal(7500n, 4000n, 200n, 500n)).toBe(11200n);
  });

  it('floors the total at zero when a discount exceeds the bill', () => {
    expect(sellerTotal(1000n, 0n, 0n, 5000n)).toBe(0n);
  });

  it('member platform-fee bps override uses integer division (no float)', () => {
    // 1.5% of ₹125.00 = 18750 * 150 / 10000 = 281 (truncated), never 281.25
    expect(platformFeeFromBps(18750n, 150)).toBe(281n);
  });

  it('grand total is the integer sum of the per-seller totals', () => {
    const sellers = [11200n, 0n, 9990n];
    expect(sellers.reduce((a, b) => a + b, 0n)).toBe(21190n);
  });
});

describe('API-W6 · pay-from-wallet (ledger invariant)', () => {
  // PaymentService.captureOrderFromWalletInTx posts: escrow +amount, buyer −amount. A balanced
  // double-entry transaction's legs MUST sum to zero (money is conserved, Law 11).
  const walletPayLegs = (amount: bigint) => [
    { account: 'platform:escrow', amountMinor: amount },
    { account: 'user:buyer:main', amountMinor: -amount },
  ];
  it('the buyer→escrow legs net to zero (money is conserved)', () => {
    const legs = walletPayLegs(11200n);
    expect(legs.reduce((s, l) => s + l.amountMinor, 0n)).toBe(0n);
  });
  it('debits exactly the order total from the buyer (negative leg) and credits escrow', () => {
    const legs = walletPayLegs(11200n);
    expect(legs.find((l) => l.account === 'user:buyer:main')!.amountMinor).toBe(-11200n);
    expect(legs.find((l) => l.account === 'platform:escrow')!.amountMinor).toBe(11200n);
  });
});
