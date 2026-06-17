// modules/payments/domain/charge.calculator.ts
// Pure calculator for dynamic buyer-side charges (delivery slabs, buyer platform fee, …) defined as
// DATA in charge_definitions (Law 6). All money is bigint minor units. calc_method drives the math:
//   flat     — config.fee_minor
//   percent  — bps of the base, optionally clamped by min_minor / max_minor
//   slab     — first slab whose upto_minor is null (catch-all) or >= the base wins → its fee_minor
//   per_unit — config.fee_minor × qty
// per_km is intentionally not handled here (it needs a resolved delivery distance — deferred).
import { applyBps } from './commission-rule.entity';

export type ChargeCalcMethod = 'flat' | 'percent' | 'slab' | 'per_unit' | 'per_km';
export interface ChargeBase { amountMinor: bigint; qty?: number; }

export class UnsupportedChargeMethodError extends Error {
  constructor(method: string) { super(`Unsupported charge calc_method '${method}'`); }
}

const big = (v: unknown, d = 0n): bigint => (v === null || v === undefined ? d : BigInt(Math.trunc(Number(v))));

export function computeCharge(method: ChargeCalcMethod, config: Record<string, any>, base: ChargeBase): bigint {
  switch (method) {
    case 'flat':
      return big(config.fee_minor);
    case 'percent': {
      let fee = applyBps(base.amountMinor, Number(config.bps ?? 0));
      if (config.min_minor != null && fee < big(config.min_minor)) fee = big(config.min_minor);
      if (config.max_minor != null && fee > big(config.max_minor)) fee = big(config.max_minor);
      return fee;
    }
    case 'slab': {
      const slabs: Array<{ upto_minor: number | null; fee_minor: number }> = Array.isArray(config.slabs) ? config.slabs : [];
      for (const s of slabs) {
        if (s.upto_minor === null || s.upto_minor === undefined || base.amountMinor <= big(s.upto_minor)) return big(s.fee_minor);
      }
      return 0n;   // no matching slab ⇒ no charge
    }
    case 'per_unit':
      return big(config.fee_minor) * BigInt(Math.max(0, Math.trunc(base.qty ?? 0)));
    default:
      throw new UnsupportedChargeMethodError(method);   // fail closed on an unknown method
  }
}
