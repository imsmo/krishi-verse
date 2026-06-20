// modules/market-intel/dto/query-price-prediction.dto.ts · zod .strict() — latest band for product+region.
import { z } from 'zod';
export const QueryPredictionSchema = z.object({
  productId: z.string().uuid(),
  regionId: z.string().uuid(),
}).strict();
export type QueryPredictionDto = z.infer<typeof QueryPredictionSchema>;
