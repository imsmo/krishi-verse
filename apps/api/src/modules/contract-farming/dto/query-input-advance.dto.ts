// modules/contract-farming/dto/query-input-advance.dto.ts · zod .strict() advance list query.
import { z } from 'zod';
export const QueryAdvancesSchema = z.object({ contractId: z.string().uuid(), growerId: z.string().uuid().optional() }).strict();
export type QueryAdvancesDto = z.infer<typeof QueryAdvancesSchema>;
