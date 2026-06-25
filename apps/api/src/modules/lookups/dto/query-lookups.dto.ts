// modules/lookups/dto/query-lookups.dto.ts · strict query DTOs for the public lookup reads. zod .strict() rejects
// unknown keys (no mass-assignment); the type code is a tight identifier (anchored, bounded) so it can't be used to
// inject or scan, and the region params are a uuid / a small int.
import { z } from 'zod';

export const LookupValuesQuerySchema = z.object({
  // a lookup_types.code: lowercase letters + underscores, bounded length (ReDoS-safe, identifier-validated)
  type: z.string().regex(/^[a-z][a-z_]{0,59}$/),
}).strict();
export type LookupValuesQueryDto = z.infer<typeof LookupValuesQuerySchema>;

export const RegionsQuerySchema = z.object({
  parentId: z.string().uuid().optional(),
  level: z.coerce.number().int().min(1).max(6).optional(),
}).strict();
export type RegionsQueryDto = z.infer<typeof RegionsQuerySchema>;
