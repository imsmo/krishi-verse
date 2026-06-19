// modules/dairy/dto/query-milk-rate-card.dto.ts · zod .strict() rate card list query.
import { z } from 'zod';
import { ANIMAL_TYPES } from '../domain/dairy.events';
export const QueryRateCardsSchema = z.object({
  animalType: z.enum(ANIMAL_TYPES as unknown as [string, ...string[]]).optional(),
  activeOnly: z.coerce.boolean().default(true),
}).strict();
export type QueryRateCardsDto = z.infer<typeof QueryRateCardsSchema>;
