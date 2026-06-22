// modules/catalogue/dto/create-category-attribute.dto.ts · CANONICAL write-contract binding an attribute to a
// category branch. (Law 11) writes run in apps/admin-api; single-sourced .strict shape, not routed here.
import { z } from 'zod';
export const CategoryAttributeConditionSchema = z.object({
  if: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  then: z.object({ required: z.array(z.string().max(80)).max(50).optional() }).strict().optional(),
}).strict();
export const CreateCategoryAttributeSchema = z.object({
  categoryId: z.string().uuid(),
  attributeId: z.string().uuid(),
  isRequired: z.boolean().default(false),
  showInFilters: z.boolean().default(false),
  showOnCard: z.boolean().default(false),
  condition: CategoryAttributeConditionSchema.nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(32767).default(100),
}).strict();
export type CreateCategoryAttributeDto = z.infer<typeof CreateCategoryAttributeSchema>;
