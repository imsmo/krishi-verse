import { z } from 'zod';
export const CreateRoleSchema = z.object({ code: z.string().min(2).max(50), defaultName: z.string().min(2).max(100), scope: z.enum(['tenant','platform']).default('tenant'), requiresKyc: z.boolean().default(false), requiresApproval: z.boolean().default(true), moduleCode: z.string().max(10).optional() }).strict();
export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;
