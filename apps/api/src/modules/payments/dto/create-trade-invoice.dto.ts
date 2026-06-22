// modules/payments/dto/create-trade-invoice.dto.ts · canonical write-contract for a buyer GST invoice. Trade
// invoices are SYSTEM-generated at order completion (the trade-invoice handler / service) — not a routed POST — so
// this is the validated internal contract, not a tenant endpoint. Money = bigint minor units.
import { z } from 'zod';
export const CreateTradeInvoiceSchema = z.object({
  orderId: z.string().uuid(),
  buyerUserId: z.string().uuid().nullable().optional(),
  sellerUserId: z.string().uuid().nullable().optional(),
  totalMinor: z.union([z.bigint(), z.string().regex(/^\d+$/)]),
  categoryId: z.string().uuid().nullable().optional(),
  countryCode: z.string().length(2).optional(),
}).strict();
export type CreateTradeInvoiceDto = z.infer<typeof CreateTradeInvoiceSchema>;
