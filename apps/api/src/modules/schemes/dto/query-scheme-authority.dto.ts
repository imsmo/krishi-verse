// modules/schemes/dto/query-scheme-authority.dto.ts · zod .strict() authority browse (read-only).
import { z } from 'zod';
export const QueryAuthoritiesSchema = z.object({ level: z.enum(['central', 'state', 'district', 'body']).optional() }).strict();
export type QueryAuthoritiesDto = z.infer<typeof QueryAuthoritiesSchema>;
