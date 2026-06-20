// modules/schemes/dto/create-dbt-transfer.dto.ts · zod .strict() observed-PFMS-credit record payload.
import { z } from 'zod';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a positive integer (minor units)');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const RecordDbtSchema = z.object({
  amountMinor: minorStr,
  instalmentNo: z.number().int().min(1).max(60).optional(),
  creditedOn: dateStr,
  pfmsRef: z.string().max(120).optional(),
}).strict();
export type RecordDbtDto = z.infer<typeof RecordDbtSchema>;
