// modules/fintech/dto/query-loan-repayment.dto.ts · zod .strict() repayment list query (by loan).
import { z } from 'zod';
export const QueryRepaymentsSchema = z.object({ loanId: z.string().uuid() }).strict();
export type QueryRepaymentsDto = z.infer<typeof QueryRepaymentsSchema>;
