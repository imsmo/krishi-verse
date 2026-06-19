// modules/contract-farming/dto/query-contract-milestone.dto.ts · zod .strict() milestone list query.
import { z } from 'zod';
export const QueryMilestonesSchema = z.object({ contractId: z.string().uuid() }).strict();
export type QueryMilestonesDto = z.infer<typeof QueryMilestonesSchema>;
