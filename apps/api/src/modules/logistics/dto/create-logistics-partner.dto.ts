// modules/logistics/dto/create-logistics-partner.dto.ts · register/update a tenant's carrier (zod .strict).
// A tenant registers its own fleets/riders/3PL integrations (tenant_id = caller); platform 3PLs are admin-api.
import { z } from 'zod';
import { PARTNER_KINDS } from '../domain/logistics-partner.entity';

export const CreateLogisticsPartnerSchema = z.object({
  partnerKind: z.enum(PARTNER_KINDS),
  defaultName: z.string().trim().min(1).max(150),
  providerCode: z.string().trim().min(2).max(60).nullable().optional(),
  riderUserId: z.string().uuid().nullable().optional(),
  supportsColdChain: z.boolean().default(false),
}).strict();
export type CreateLogisticsPartnerDto = z.infer<typeof CreateLogisticsPartnerSchema>;

export const UpdateLogisticsPartnerSchema = z.object({
  defaultName: z.string().trim().min(1).max(150).optional(),
  providerCode: z.string().trim().min(2).max(60).nullable().optional(),
  supportsColdChain: z.boolean().optional(),
}).strict().refine((d) => d.defaultName !== undefined || d.providerCode !== undefined || d.supportsColdChain !== undefined, { message: 'at least one field is required' });
export type UpdateLogisticsPartnerDto = z.infer<typeof UpdateLogisticsPartnerSchema>;

export const SetActiveSchema = z.object({ isActive: z.boolean() }).strict();
export type SetActiveDto = z.infer<typeof SetActiveSchema>;
