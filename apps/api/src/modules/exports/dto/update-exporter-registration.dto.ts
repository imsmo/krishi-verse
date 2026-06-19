// modules/exports/dto/update-exporter-registration.dto.ts · zod .strict() exporter patch.
import { z } from 'zod';
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const UpdateExporterSchema = z.object({
  iecCode: z.string().regex(/^[A-Z0-9]{10}$/).optional(),
  validUntil: dateStr.optional(),
  docId: z.string().uuid().optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'at least one field required' });
export type UpdateExporterDto = z.infer<typeof UpdateExporterSchema>;
