// modules/requirements/dto/update-requirement.dto.ts · zod .strict() (rejects unknown keys → no
// mass-assignment). The buyer edits an OPEN requirement (before it's fulfilled/closed): refine the
// title, quantity, budget window, need-by, delivery pincode, urgency, or the product/category target.
// At least one field must be present; identifiers are normalised; money stays minor-unit integer strings.
import { z } from 'zod';

const minor0 = z.string().regex(/^\d{1,16}$/, 'must be a non-negative integer string of minor units');
const qty = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'must be a positive number with up to 3 decimals');

export const UpdateRequirementSchema = z.object({
  title: z.string().min(3).max(250).optional(),
  quantity: qty.optional(),
  unitCode: z.string().min(1).max(20).optional(),
  productId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  budgetMinMinor: minor0.nullable().optional(),
  budgetMaxMinor: minor0.nullable().optional(),
  needBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'needBy must be YYYY-MM-DD').nullable().optional(),
  deliveryPincode: z.string().regex(/^\d{6}$/, 'pincode must be 6 digits').nullable().optional(),
  isUrgent: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: 'at least one field must be provided' });
export type UpdateRequirementDto = z.infer<typeof UpdateRequirementSchema>;
