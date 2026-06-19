// modules/warehousing/dto/query-assay-report.dto.ts · zod .strict() assay list query (by booking).
import { z } from 'zod';
export const QueryAssaysSchema = z.object({ storageBookingId: z.string().uuid() }).strict();
export type QueryAssaysDto = z.infer<typeof QueryAssaysSchema>;
