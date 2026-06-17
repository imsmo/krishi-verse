// modules/payments/dto/create-settlement-statement.dto.ts · zod .strict() statement-generation request.
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export const GenerateStatementSchema = z.object({
  sellerUserId: z.string().uuid(),
  from: isoDate,        // inclusive period start
  to: isoDate,          // exclusive period end
}).strict().refine((v) => v.from < v.to, { message: 'from must be before to' });
export type GenerateStatementDto = z.infer<typeof GenerateStatementSchema>;
