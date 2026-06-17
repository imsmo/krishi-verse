// modules/payments/services/charge-pricing.service.ts
// The buyer-charge ENGINE: resolves a charge definition (tenant override → platform default) and
// computes the fee (pure math in charge.calculator). Read-only — it quotes amounts; it never moves
// money. Used by the orders checkout to add delivery + platform fees to the buyer's bill. An
// unknown/unconfigured charge resolves to 0 (no surprise fees).
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { computeCharge } from '../domain/charge.calculator';
import { ChargeDefinitionRepository } from '../repositories/charge-definition.repository';

export interface CheckoutCharges { deliveryFeeMinor: bigint; platformFeeMinor: bigint; }

@Injectable()
export class ChargePricingService {
  constructor(private readonly defs: ChargeDefinitionRepository) {}

  /** Quote a single charge by code. Returns 0n when no active definition applies. */
  async quote(tx: TxContext, tenantId: string, chargeCode: string, base: { amountMinor: bigint; qty?: number }, onDate?: string): Promise<bigint> {
    const def = await this.defs.resolve(tx, tenantId, chargeCode, onDate);
    if (!def) return 0n;
    return computeCharge(def.calcMethod, def.config, base);
  }

  /** The two buyer-side charges applied at checkout, computed on the order subtotal. */
  async checkoutCharges(tx: TxContext, tenantId: string, subtotalMinor: bigint): Promise<CheckoutCharges> {
    const [deliveryFeeMinor, platformFeeMinor] = await Promise.all([
      this.quote(tx, tenantId, 'delivery_fee', { amountMinor: subtotalMinor }),
      this.quote(tx, tenantId, 'buyer_platform_fee', { amountMinor: subtotalMinor }),
    ]);
    return { deliveryFeeMinor, platformFeeMinor };
  }
}
