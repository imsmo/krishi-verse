// modules/tenancy/dto/create-plan.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
import { z } from 'zod';
const minor0 = z.string().regex(/^\d{1,16}$/, 'must be a non-negative integer string of minor units');
// limit value: a signed integer string; -1 = unlimited (matches plan_limits.limit_value semantics).
const limitVal = z.string().regex(/^(-1|\d{1,18})$/, 'limit must be a non-negative integer or -1 (unlimited)');

export const CreatePlanSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_]{2,40}$/),
  version: z.number().int().min(1).max(1000).optional(),
  defaultName: z.string().min(2).max(100),
  countryCode: z.string().length(2),
  currencyCode: z.string().length(3),
  monthlyPriceMinor: minor0,
  annualPriceMinor: minor0,
  setupFeeMinor: minor0.optional(),
  isPublic: z.boolean().optional(),
  limits: z.record(z.string().regex(/^[a-z0-9_]{2,60}$/), limitVal).optional(),
}).strict();
export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;
