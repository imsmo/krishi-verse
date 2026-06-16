import { z } from 'zod';
export const QueryPermissionSchema = z.object({ moduleCode: z.string().max(10).optional() }).strict();
export type QueryPermissionDto = z.infer<typeof QueryPermissionSchema>;
