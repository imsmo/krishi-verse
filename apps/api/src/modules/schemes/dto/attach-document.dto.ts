// modules/schemes/dto/attach-document.dto.ts · attach a clean media asset to a scheme application (P1-16).
import { z } from 'zod';

export const AttachDocumentSchema = z.object({
  mediaId: z.string().uuid(),                                    // a confirmed, AV-scanned media asset the caller uploaded
  docTypeId: z.string().min(1).max(80).optional(),               // one of the scheme's required_doc_type_ids (omit = supplementary)
  note: z.string().max(300).optional(),
}).strict();
export type AttachDocumentDto = z.infer<typeof AttachDocumentSchema>;
