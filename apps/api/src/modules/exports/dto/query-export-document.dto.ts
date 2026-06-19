// modules/exports/dto/query-export-document.dto.ts · zod .strict() document list query (by shipment).
import { z } from 'zod';
export const QueryDocumentsSchema = z.object({ shipmentId: z.string().uuid() }).strict();
export type QueryDocumentsDto = z.infer<typeof QueryDocumentsSchema>;
