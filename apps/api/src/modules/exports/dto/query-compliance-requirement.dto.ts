// modules/exports/dto/query-compliance-requirement.dto.ts · zod .strict() compliance browse (read-only).
import { z } from 'zod';
export const QueryComplianceSchema = z.object({
  destinationCountry: z.string().regex(/^[A-Z]{2}$/),
  categoryId: z.string().uuid().optional(),
}).strict();
export type QueryComplianceDto = z.infer<typeof QueryComplianceSchema>;
