import { z } from 'zod';
export const ProductAttrSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), attributeId: z.string().uuid(), text: z.string().max(2000) }),
  z.object({ kind: z.literal('number'), attributeId: z.string().uuid(), number: z.number() }),
  z.object({ kind: z.literal('bool'), attributeId: z.string().uuid(), bool: z.boolean() }),
  z.object({ kind: z.literal('date'), attributeId: z.string().uuid(), date: z.string().date() }),
  z.object({ kind: z.literal('option'), attributeId: z.string().uuid(), optionId: z.string().uuid() }),
]);
export type ProductAttr = z.infer<typeof ProductAttrSchema>;
