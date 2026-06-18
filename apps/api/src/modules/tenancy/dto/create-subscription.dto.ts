// modules/tenancy/dto/create-subscription.dto.ts · zod .strict() subscribe / change-plan payloads.
import { z } from 'zod';
import { BILLING_CYCLES } from '../domain/tenancy.events';
export const SubscribeSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(BILLING_CYCLES as unknown as [string, ...string[]]).default('monthly'),
}).strict();
export type SubscribeDto = z.infer<typeof SubscribeSchema>;

export const ChangePlanSchema = z.object({ planId: z.string().uuid() }).strict();
export type ChangePlanDto = z.infer<typeof ChangePlanSchema>;

export const CancelSubscriptionSchema = z.object({ atPeriodEnd: z.boolean().default(false) }).strict();
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionSchema>;
