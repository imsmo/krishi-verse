// apps/admin-api/src/modules/providers-ops/domain/category.ts · the integration-provider category vocabulary
// (db/migrations/0002 comment + seeds). FINANCIAL categories are the money-path providers (payment gateways +
// KYC) the finance ops lens focuses on. Used to validate read filters — providers themselves are platform-seeded,
// not created at runtime.
export const PROVIDER_CATEGORIES = ['payment', 'sms', 'kyc', 'government', 'satellite'] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const FINANCIAL_CATEGORIES: readonly ProviderCategory[] = ['payment', 'kyc'];

import { InvalidCategoryError } from './providers-ops.errors';
export function assertCategory(c: string): ProviderCategory {
  if (!(PROVIDER_CATEGORIES as readonly string[]).includes(c)) throw new InvalidCategoryError(`unknown category '${c}'`);
  return c as ProviderCategory;
}
