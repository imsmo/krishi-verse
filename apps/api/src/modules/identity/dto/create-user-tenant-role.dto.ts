import { z } from 'zod';
export const AssignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleCode: z.string().min(2).max(50),
  roleData: z.record(z.string(), z.unknown()).optional(),
}).strict();
export type AssignRoleDto = z.infer<typeof AssignRoleSchema>;

export const StaffOverrideSchema = z.object({
  userTenantRoleId: z.string().uuid(),
  permissionCode: z.string().min(2).max(80),
  isGranted: z.boolean(),
}).strict();
export type StaffOverrideDto = z.infer<typeof StaffOverrideSchema>;
