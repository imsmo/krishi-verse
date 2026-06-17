// modules/payments/repositories/tax-rule.repository.ts
// Resolves effective tax rules (GST / 194-O TDS / cess) by country + tax_code. tax_rules is GLOBAL
// platform master data (no tenant_id) — country-level statutory rates, effective-dated, with an
// optional category override (category-specific rate beats the country default). Parameterized only.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { TaxRuleValues } from '../domain/commission-rule.entity';

@Injectable()
export class TaxRuleRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Resolve the effective rate for a tax_code (e.g. 'gst', 'tds_194o') within the caller's tx. */
  async resolve(tx: TxContext, opts: { countryCode: string; taxCode: string; categoryId: string | null; onDate?: string }): Promise<TaxRuleValues | null> {
    const r = await tx.query<{ rate_bps: number; threshold_minor: string | null }>(
      `SELECT rate_bps, threshold_minor FROM tax_rules
        WHERE is_active = true AND country_code = $1 AND tax_code = $2
          AND (category_id = $3 OR category_id IS NULL)
          AND effective_from <= COALESCE($4::date, CURRENT_DATE)
          AND (effective_to IS NULL OR effective_to >= COALESCE($4::date, CURRENT_DATE))
        ORDER BY (category_id IS NOT NULL) DESC, effective_from DESC
        LIMIT 1`,
      [opts.countryCode, opts.taxCode, opts.categoryId, opts.onDate ?? null]);
    if (!r.rows[0]) return null;
    return { rateBps: r.rows[0].rate_bps, thresholdMinor: r.rows[0].threshold_minor != null ? BigInt(r.rows[0].threshold_minor) : null };
  }
}
