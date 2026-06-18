// modules/memberships/dto/create-membership-tier.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
import { z } from 'zod';
const minor0 = z.string().regex(/^\d{1,16}$/, 'must be a non-negative integer string of minor units');

export const TierBenefitsSchema = z.object({
  freeDelivery: z.boolean().optional(),
  creditDays: z.number().int().min(0).max(365).optional(),
  creditLimitMinor: minor0.optional(),
}).strict();

export const CreateTierSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_]{2,40}$/, 'code must be 2..40 chars of a-z 0-9 _'),
  defaultName: z.string().min(2).max(120),
  audienceRoleId: z.string().uuid().optional(),
  monthlyFeeMinor: minor0,
  annualFeeMinor: minor0.optional(),
  currencyCode: z.string().length(3).optional(),
  platformFeeBpsOverride: z.number().int().min(0).max(10000).optional(),
  benefits: TierBenefitsSchema.optional(),
}).strict();
export type CreateTierDto = z.infer<typeof CreateTierSchema>;
