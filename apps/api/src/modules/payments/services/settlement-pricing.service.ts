// modules/payments/services/settlement-pricing.service.ts
// The commission/tax ENGINE: resolves the effective, most-specific commission rule + GST/TDS tax
// rules for an order, then computes the zero-sum SettlementBreakdown (pure math in
// commission-rule.entity). Read-only — it never moves money; the OrderCompletedHandler posts the
// resulting legs through the wallet boundary. Fails CLOSED (no commission rule ⇒ throw, don't settle).
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { computeSettlement, SettlementBreakdown } from '../domain/commission-rule.entity';
import { NoCommissionRuleError } from '../domain/commission.errors';
import { CommissionRuleRepository } from '../repositories/commission-rule.repository';
import { TaxRuleRepository } from '../repositories/tax-rule.repository';

export interface SettlementQuoteInput {
  tenantId: string;
  grossMinor: bigint;
  categoryId?: string | null;
  sellerRoleId?: string | null;
  source?: string | null;
  countryCode?: string;          // for tax resolution (default 'IN')
  onDate?: string;
}

@Injectable()
export class SettlementPricingService {
  constructor(private readonly commission: CommissionRuleRepository, private readonly tax: TaxRuleRepository) {}

  async quote(tx: TxContext, input: SettlementQuoteInput): Promise<SettlementBreakdown> {
    const rule = await this.commission.resolveBest(tx, {
      tenantId: input.tenantId, categoryId: input.categoryId ?? null, sellerRoleId: input.sellerRoleId ?? null, source: input.source ?? null, onDate: input.onDate,
    });
    if (!rule) throw new NoCommissionRuleError({ tenantId: input.tenantId, source: input.source ?? null });

    const country = input.countryCode ?? 'IN';
    const gst = await this.tax.resolve(tx, { countryCode: country, taxCode: 'gst', categoryId: input.categoryId ?? null, onDate: input.onDate });
    const tds = await this.tax.resolve(tx, { countryCode: country, taxCode: 'tds_194o', categoryId: input.categoryId ?? null, onDate: input.onDate });

    return computeSettlement(input.grossMinor, rule, gst, tds);
  }
}
