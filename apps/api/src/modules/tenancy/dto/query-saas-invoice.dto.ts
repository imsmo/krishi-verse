// modules/tenancy/dto/query-saas-invoice.dto.ts · list the calling tenant's SaaS invoices, keyset pagination.
import { z } from 'zod';
import { INVOICE_STATUSES } from '../domain/saas-invoice.state';
export const QuerySaasInvoiceSchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QuerySaasInvoiceDto = z.infer<typeof QuerySaasInvoiceSchema>;
