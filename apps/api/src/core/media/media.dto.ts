// core/media/media.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
import { z } from 'zod';

export const RequestUploadSchema = z.object({
  kind: z.enum(['image', 'video', 'audio', 'document']),
  mimeType: z.string().min(3).max(100),
  declaredBytes: z.coerce.number().int().positive(),
}).strict();
export type RequestUploadDto = z.infer<typeof RequestUploadSchema>;

export const ConfirmUploadSchema = z.object({
  bytes: z.coerce.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i, 'sha256 must be 64 hex chars'),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
}).strict();
export type ConfirmUploadDto = z.infer<typeof ConfirmUploadSchema>;
