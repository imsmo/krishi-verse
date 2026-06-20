// modules/schemes/dto/query-dbt-transfer.dto.ts · zod .strict() DBT list query (by application).
import { z } from 'zod';
export const QueryDbtSchema = z.object({ applicationId: z.string().uuid() }).strict();
export type QueryDbtDto = z.infer<typeof QueryDbtSchema>;
