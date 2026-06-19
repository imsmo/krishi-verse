// modules/exports/dto/create-export-document.dto.ts · zod .strict() document add + status-set payloads.
import { z } from 'zod';
import { DOCUMENT_STATUSES } from '../domain/export-document.state';
export const AddDocumentSchema = z.object({
  docTypeCode: z.string().min(1).max(60),
  mediaId: z.string().uuid().optional(),
  referenceNo: z.string().max(80).optional(),
}).strict();
export type AddDocumentDto = z.infer<typeof AddDocumentSchema>;

export const SetDocumentStatusSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES as unknown as [string, ...string[]]),
  mediaId: z.string().uuid().optional(),
  referenceNo: z.string().max(80).optional(),
}).strict();
export type SetDocumentStatusDto = z.infer<typeof SetDocumentStatusSchema>;
