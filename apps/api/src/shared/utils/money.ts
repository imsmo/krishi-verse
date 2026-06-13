// shared/utils/money.ts
// Money value object — BIGINT minor units only (Law 2). No floats, ever.
// Immutable, currency-checked arithmetic. Used platform-wide.
export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) { super(`CURRENCY_MISMATCH:${a}!=${b}`); }
}
export class Money {
  private constructor(readonly minor: bigint, readonly currency: string) {}
  static of(minor: bigint | number | string, currency = 'INR'): Money {
    return new Money(typeof minor === 'bigint' ? minor : BigInt(minor), currency);
  }
  static zero(currency = 'INR') { return new Money(0n, currency); }
  private same(o: Money) { if (o.currency !== this.currency) throw new CurrencyMismatchError(this.currency, o.currency); }
  add(o: Money) { this.same(o); return new Money(this.minor + o.minor, this.currency); }
  sub(o: Money) { this.same(o); return new Money(this.minor - o.minor, this.currency); }
  /** bps = basis points (100 = 1%). Banker's-safe integer math. */
  pctBps(bps: number) { return new Money((this.minor * BigInt(bps)) / 10000n, this.currency); }
  isPositive() { return this.minor > 0n; }
  gte(o: Money) { this.same(o); return this.minor >= o.minor; }
  toString() { return `${this.currency} ${(Number(this.minor) / 100).toFixed(2)}`; }
  toJSON() { return { minor: this.minor.toString(), currency: this.currency }; }
}
