// modules/exports/dto/create-exporter-registration.dto.ts · zod .strict() exporter registration payload.
import { z } from 'zod';
import { EXPORT_AUTHORITIES } from '../domain/exports.events';
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const RegisterExporterSchema = z.object({
  authority: z.enum(EXPORT_AUTHORITIES as unknown as [string, ...string[]]),
  regNo: z.string().min(1).max(60),
  iecCode: z.string().regex(/^[A-Z0-9]{10}$/, 'IEC is 10 alphanumerics').optional(),
  validUntil: dateStr.optional(),
  docId: z.string().uuid().optional(),
}).strict();
export type RegisterExporterDto = z.infer<typeof RegisterExporterSchema>;
