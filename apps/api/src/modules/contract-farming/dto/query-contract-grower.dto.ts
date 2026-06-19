// modules/contract-farming/dto/query-contract-grower.dto.ts · zod .strict() grower list query.
import { z } from 'zod';
export const QueryGrowersSchema = z.object({ contractId: z.string().uuid() }).strict();
export type QueryGrowersDto = z.infer<typeof QueryGrowersSchema>;
