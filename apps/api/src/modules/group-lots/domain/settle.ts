// modules/group-lots/domain/settle.ts · PURE, float-free proportional settlement of a group lot's sale
// proceeds across its pledgers. The coordinator takes a fee (basis points) off the gross; the NET is split
// in proportion to each pledger's quantity. Remainder paise from integer division are allocated largest-share-
// first so the parts SUM EXACTLY to the net (zero-loss — Law 2). All money is bigint minor units.

function roundDiv(num: bigint, den: bigint): bigint { return den === 0n ? 0n : (num + den / 2n) / den; }

export interface SettlementInput { grossMinor: bigint; coordinationFeeBps: number; pledges: { id: string; qtyMilli: bigint }[]; }
export interface SettlementResult {
  grossMinor: bigint; coordinationFeeMinor: bigint; netMinor: bigint;
  shares: { id: string; shareMinor: bigint }[];
}

/** Split `grossMinor` minus the coordination fee across pledges proportionally to quantity, with exact remainder
 *  allocation. Throws nothing; callers validate non-empty pledges + positive total upstream. */
export function settleShares(input: SettlementInput): SettlementResult {
  const gross = input.grossMinor < 0n ? 0n : input.grossMinor;
  const bps = BigInt(Math.max(0, Math.min(10000, Math.trunc(input.coordinationFeeBps))));
  const fee = roundDiv(gross * bps, 10000n);
  const net = gross - fee;
  const total = input.pledges.reduce((a, p) => a + (p.qtyMilli > 0n ? p.qtyMilli : 0n), 0n);
  if (total === 0n) return { grossMinor: gross, coordinationFeeMinor: fee, netMinor: net, shares: input.pledges.map((p) => ({ id: p.id, shareMinor: 0n })) };

  // Floor each share, track remainder, then hand out the leftover paise to the largest quantities first.
  const raw = input.pledges.map((p) => ({ id: p.id, qty: p.qtyMilli > 0n ? p.qtyMilli : 0n, floor: (net * (p.qtyMilli > 0n ? p.qtyMilli : 0n)) / total }));
  let allocated = raw.reduce((a, r) => a + r.floor, 0n);
  let leftover = net - allocated;
  // order by qty desc, then id asc for determinism
  const order = [...raw].sort((a, b) => (b.qty > a.qty ? 1 : b.qty < a.qty ? -1 : (a.id < b.id ? -1 : 1)));
  const bump = new Map<string, bigint>();
  for (const r of order) { if (leftover <= 0n) break; bump.set(r.id, 1n); leftover -= 1n; }
  const shares = raw.map((r) => ({ id: r.id, shareMinor: r.floor + (bump.get(r.id) ?? 0n) }));
  return { grossMinor: gross, coordinationFeeMinor: fee, netMinor: net, shares };
}

/** Parse a validated decimal quantity string (≤3 dp) into integer milli-units (e.g. "12.5" → 12500n). No float. */
export function parseQtyMilli(s: string): bigint {
  const [int, frac = ''] = s.split('.');
  const fracPadded = (frac + '000').slice(0, 3);
  return BigInt(int + fracPadded);
}
/** Format integer milli-units back to a 3-dp decimal string. */
export function formatQtyMilli(milli: bigint): string {
  const neg = milli < 0n; const v = neg ? -milli : milli;
  const whole = v / QTY; const frac = (v % QTY).toString().padStart(3, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
}
const QTY = 1000n;
