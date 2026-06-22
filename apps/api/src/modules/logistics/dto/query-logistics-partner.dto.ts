// modules/logistics/dto/query-logistics-partner.dto.ts · list a tenant's carriers (+ platform 3PLs), keyset.
import { z } from 'zod';
import { PARTNER_KINDS } from '../domain/logistics-partner.entity';

export const QueryLogisticsPartnerSchema = z.object({
  partnerKind: z.enum(PARTNER_KINDS).optional(),
  activeOnly: z.coerce.boolean().default(true),
  includePlatform: z.coerce.boolean().default(true),   // include platform 3PLs (tenant_id NULL)
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryLogisticsPartnerDto = z.infer<typeof QueryLogisticsPartnerSchema>;
