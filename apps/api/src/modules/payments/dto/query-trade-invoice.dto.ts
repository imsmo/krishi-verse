// modules/payments/dto/query-trade-invoice.dto.ts · fetch a buyer GST invoice by order (the canonical lookup key).
import { z } from 'zod';
export const QueryTradeInvoiceSchema = z.object({
  orderId: z.string().uuid(),
}).strict();
export type QueryTradeInvoiceDto = z.infer<typeof QueryTradeInvoiceSchema>;
