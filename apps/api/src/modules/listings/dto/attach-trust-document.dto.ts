// modules/listings/dto/attach-trust-document.dto.ts · KV-BL-031 (screen 112 trust badge).
// LINKS an already-uploaded, clean media asset (kind='document', core/media pipeline) to a listing — this
// endpoint never receives raw bytes. Mirrors schemes/dto/attach-document.dto.ts's shape.
import { z } from 'zod';
export const TRUST_DOCUMENT_TYPES = ['lab_report', 'certification', 'other'] as const;
export const AttachTrustDocumentSchema = z.object({
  mediaAssetId: z.string().uuid(),
  docType: z.enum(TRUST_DOCUMENT_TYPES),
}).strict();
export type AttachTrustDocumentDto = z.infer<typeof AttachTrustDocumentSchema>;
