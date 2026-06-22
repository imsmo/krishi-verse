// modules/catalogue/dto/update-category.dto.ts · CANONICAL write-contract to edit a global category node's
// non-structural fields. (Law 11) writes run in apps/admin-api; single-sourced .strict shape, not routed here.
import { z } from 'zod';
import { COMMERCE_KINDS } from './create-category.dto';
export const UpdateCategorySchema = z.object({
  defaultName: z.string().min(1).max(150).optional(),
  commerceKind: z.enum(COMMERCE_KINDS).optional(),
  requiresLicense: z.boolean().optional(),
  requiresCertificate: z.boolean().optional(),
  minAge: z.coerce.number().int().min(0).max(120).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(32767).optional(),
  iconMediaId: z.string().uuid().nullable().optional(),
}).strict().refine(
  (d) => ['defaultName', 'commerceKind', 'requiresLicense', 'requiresCertificate', 'minAge', 'sortOrder', 'iconMediaId'].some((k) => (d as Record<string, unknown>)[k] !== undefined),
  { message: 'at least one mutable field is required' });
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
