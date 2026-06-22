// modules/tenancy/dto/query-tenant-domain.dto.ts · list the calling tenant's domains, keyset pagination.
import { z } from 'zod';
export const QueryTenantDomainSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryTenantDomainDto = z.infer<typeof QueryTenantDomainSchema>;
