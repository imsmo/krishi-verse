// modules/payments/dto/create-commission-rule.dto.ts · a tenant finance admin defines a commission OVERRIDE for
// its own tenant (zod .strict). The platform-default rules (tenant_id NULL) are god-mode (admin-api) and are NOT
// settable here. Money is bigint minor units (strings on the wire); rates are basis points.
import { z } from 'zod';

const Minor = z.union([z.bigint(), z.string().regex(/^\d+$/)]);
const Bps = z.number().int().min(0).max(100000);

export const CreateCommissionRuleSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  source: z.enum(['direct', 'auction', 'requirement', 'subscription']).nullable().optional(),
  sellerRoleId: z.string().uuid().nullable().optional(),
  rateBps: Bps,
  fixedMinor: Minor.default('0'),
  capMinor: Minor.nullable().optional(),
  platformShareBps: Bps,
  chargedTo: z.enum(['seller', 'buyer']).default('seller'),
  priority: z.number().int().min(0).max(1000).default(100),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict();
export type CreateCommissionRuleDto = z.infer<typeof CreateCommissionRuleSchema>;
