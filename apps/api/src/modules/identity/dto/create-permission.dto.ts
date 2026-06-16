import { z } from 'zod';
export const CreatePermissionSchema = z.object({ code: z.string().min(2).max(80), defaultName: z.string().min(2).max(150), moduleCode: z.string().max(10).optional() }).strict();
export type CreatePermissionDto = z.infer<typeof CreatePermissionSchema>;
