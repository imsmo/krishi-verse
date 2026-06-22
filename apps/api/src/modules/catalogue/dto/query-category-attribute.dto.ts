// modules/catalogue/dto/query-category-attribute.dto.ts · the raw attribute BINDINGS of a category branch
// (incl. inherited). Distinct from QueryAttributesForCategory (which returns hydrated definitions + options for
// the form/facets); this returns the binding metadata (required/filters/card/condition/sort).
import { z } from 'zod';
export const QueryCategoryAttributeSchema = z.object({
  categoryId: z.string().uuid(),
}).strict();
export type QueryCategoryAttributeDto = z.infer<typeof QueryCategoryAttributeSchema>;
