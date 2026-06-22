// modules/tenancy/dto/query-tenant-settings.dto.ts · list the calling tenant's settings (bounded).
import { z } from 'zod';
export const QueryTenantSettingsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
}).strict();
export type QueryTenantSettingsDto = z.infer<typeof QueryTenantSettingsSchema>;
