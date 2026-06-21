// apps/admin-api/src/modules/billing-ops/domain/adjustment.ts · pure rules for a MANUAL billing adjustment.
// Money is bigint MINOR UNITS only (Law 2) and moves ONLY via the wallet-service — this builds the balanced,
// double-entry legs the wallet-service will post (it never writes the ledger here). A 'credit' moves value FROM
// the platform promo-liability account TO the tenant's main wallet (goodwill / make-good); a 'debit' is the
// reverse (clawback / correction). Either way the two signed legs sum to ZERO — no money is created or destroyed.
import { AdjustmentLeg } from '../../../core/wallet/wallet-admin.port';
import { InvalidAdjustmentError } from './billing-ops.errors';

export type AdjustmentDirection = 'credit' | 'debit';

// Defence against fat-finger / abuse: a single manual adjustment is capped (₹10,00,000 = 1,000,000,00 paise).
// Larger corrections must be split + individually justified. Tune via review, not silently.
export const MAX_ADJUSTMENT_MINOR = 100_000_000n;

/** The platform counter-account for manual billing adjustments (liability the platform carries to the tenant). */
export const ADJUSTMENT_PLATFORM_ACCOUNT = 'promo_liability';
export const TENANT_ACCOUNT = 'main';

/** Validate the adjustment amount (positive, within cap). Returns the bigint minor-unit amount. */
export function assertAdjustmentAmount(amountMinor: bigint): bigint {
  if (amountMinor <= 0n) throw new InvalidAdjustmentError('amount_minor must be a positive integer (minor units)');
  if (amountMinor > MAX_ADJUSTMENT_MINOR) throw new InvalidAdjustmentError(`amount exceeds the per-adjustment cap (${MAX_ADJUSTMENT_MINOR})`);
  return amountMinor;
}

/**
 * Build the balanced double-entry legs for an adjustment. For a credit the tenant's main account is credited
 * (+amount) and the platform promo-liability is debited (−amount); a debit is the mirror image. Legs always
 * sum to zero — the wallet-service rejects anything that doesn't (zero-sum invariant).
 */
export function buildAdjustmentLegs(tenantId: string, direction: AdjustmentDirection, amountMinor: bigint): AdjustmentLeg[] {
  assertAdjustmentAmount(amountMinor);
  const toTenant = direction === 'credit' ? amountMinor : -amountMinor;
  return [
    { ownerKind: 'tenant', ownerId: tenantId, accountCode: TENANT_ACCOUNT, amountMinor: toTenant },
    { ownerKind: 'platform', accountCode: ADJUSTMENT_PLATFORM_ACCOUNT, amountMinor: -toTenant },
  ];
}
