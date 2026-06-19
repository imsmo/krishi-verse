// modules/dairy/dto/create-milk-bill.dto.ts · zod .strict() bill generation + deduction payloads.
import { z } from 'zod';
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const minorStr = z.string().regex(/^\d{1,15}$/);
export const GenerateBillSchema = z.object({
  membershipId: z.string().uuid(),
  periodStart: dateStr,
  periodEnd: dateStr,
  deductions: z.array(z.object({ type: z.string().min(1).max(40), amountMinor: minorStr }).strict()).max(20).default([]),
}).strict();
export type GenerateBillDto = z.infer<typeof GenerateBillSchema>;
