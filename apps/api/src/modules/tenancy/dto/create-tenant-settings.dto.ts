// modules/tenancy/dto/create-tenant-settings.dto.ts · upsert a typed tenant setting (zod .strict). `value` is an
// arbitrary JSON value here and is type-checked against the setting_definition (value_type + tenant scope) in the
// domain — fail closed on unknown keys, wrong types, or non-tenant scope.
import { z } from 'zod';
export const PutTenantSettingSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_.]+$/),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown()), z.array(z.unknown())]),
}).strict();
export type PutTenantSettingDto = z.infer<typeof PutTenantSettingSchema>;
