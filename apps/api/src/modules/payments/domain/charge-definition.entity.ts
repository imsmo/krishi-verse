// modules/payments/domain/charge-definition.entity.ts · a dynamic fee definition (0006 charge_definitions): the
// effective-dated config behind buyer platform fees, delivery slabs, boost prices, EMD, etc. Pure TS value object
// that VALIDATES the config shape per calc_method (the runtime math lives in charge.calculator). charge_definitions
// is hybrid-tenant (tenant_id NULL = platform default) and is resolved at checkout/settlement. Money = bigint minor.
import { ChargeCalcMethod } from './charge.calculator';
import { InvalidChargeDefinitionError } from './commission.errors';

export const CHARGE_CALC_METHODS: readonly ChargeCalcMethod[] = ['flat', 'percent', 'slab', 'per_unit', 'per_km'] as const;

export interface ChargeDefinitionProps {
  id: string; tenantId: string | null; chargeCode: string; calcMethod: ChargeCalcMethod; config: Record<string, unknown>;
  currencyCode: string; effectiveFrom: string; effectiveTo: string | null; isActive: boolean;
}

/** Validate a charge config against its calc_method. Throws InvalidChargeDefinitionError on a malformed shape. */
export function assertChargeConfig(method: ChargeCalcMethod, config: Record<string, unknown>): void {
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  switch (method) {
    case 'flat': case 'per_unit':
      if (!num(config.fee_minor) || (config.fee_minor as number) < 0) throw new InvalidChargeDefinitionError(`${method} requires fee_minor ≥ 0`);
      return;
    case 'percent':
      if (!num(config.bps) || (config.bps as number) < 0 || (config.bps as number) > 100000) throw new InvalidChargeDefinitionError('percent requires bps 0..100000');
      return;
    case 'slab': {
      const slabs = config.slabs;
      if (!Array.isArray(slabs) || slabs.length === 0 || slabs.length > 100) throw new InvalidChargeDefinitionError('slab requires 1..100 slabs');
      for (const s of slabs as any[]) { if (!num(s.fee_minor) || (s.fee_minor < 0)) throw new InvalidChargeDefinitionError('each slab needs fee_minor ≥ 0'); if (s.upto_minor != null && !num(s.upto_minor)) throw new InvalidChargeDefinitionError('slab upto_minor must be a number or null'); }
      return;
    }
    case 'per_km':
      if (!num(config.per_km_minor) || (config.per_km_minor as number) < 0) throw new InvalidChargeDefinitionError('per_km requires per_km_minor ≥ 0');
      return;
    default:
      throw new InvalidChargeDefinitionError(`unknown calc_method ${method}`);
  }
}

export class ChargeDefinition {
  private constructor(private p: ChargeDefinitionProps) {}
  static create(input: ChargeDefinitionProps): ChargeDefinition {
    if (!input.chargeCode || input.chargeCode.length > 60) throw new InvalidChargeDefinitionError('charge_code required (≤60)');
    if (!(CHARGE_CALC_METHODS as readonly string[]).includes(input.calcMethod)) throw new InvalidChargeDefinitionError(`calc_method must be one of ${CHARGE_CALC_METHODS.join('|')}`);
    assertChargeConfig(input.calcMethod, input.config);
    return new ChargeDefinition(input);
  }
  static rehydrate(p: ChargeDefinitionProps): ChargeDefinition { return new ChargeDefinition(p); }
  get scope(): 'platform' | 'tenant' { return this.p.tenantId == null ? 'platform' : 'tenant'; }
  toProps(): Readonly<ChargeDefinitionProps> { return Object.freeze({ ...this.p, config: { ...this.p.config } }); }
}
