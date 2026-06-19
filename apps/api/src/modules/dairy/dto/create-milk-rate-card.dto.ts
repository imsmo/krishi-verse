// modules/dairy/dto/create-milk-rate-card.dto.ts · zod .strict() rate card create (rates as minor-unit strings).
import { z } from 'zod';
import { PRICING_MODELS, ANIMAL_TYPES } from '../domain/dairy.events';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a non-negative integer (minor units)');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const CreateRateCardSchema = z.object({
  defaultName: z.string().min(1).max(120),
  animalType: z.enum(ANIMAL_TYPES as unknown as [string, ...string[]]),
  pricingModel: z.enum(PRICING_MODELS as unknown as [string, ...string[]]),
  ratePerKgFatMinor: minorStr.optional(),
  ratePerKgSnfMinor: minorStr.optional(),
  baseRatePerLitreMinor: minorStr.optional(),
  effectiveFrom: dateStr,
  effectiveTo: dateStr.optional(),
}).strict();
export type CreateRateCardDto = z.infer<typeof CreateRateCardSchema>;
