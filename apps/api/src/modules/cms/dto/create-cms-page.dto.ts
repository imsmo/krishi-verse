// modules/cms/dto/create-cms-page.dto.ts · zod .strict() — author a page (new slug or a new version).
import { z } from 'zod';
import { PAGE_KINDS } from '../domain/cms.events';
export const CreatePageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(150),
  pageKind: z.enum(PAGE_KINDS as unknown as [string, ...string[]]).default('static'),
  defaultTitle: z.string().min(1).max(250),
  body: z.string().min(1).max(200000),
}).strict();
export type CreatePageDto = z.infer<typeof CreatePageSchema>;
