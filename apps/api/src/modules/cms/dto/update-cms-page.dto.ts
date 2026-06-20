// modules/cms/dto/update-cms-page.dto.ts · zod .strict() — edit a DRAFT page version.
import { z } from 'zod';
import { PAGE_KINDS } from '../domain/cms.events';
export const UpdatePageSchema = z.object({
  defaultTitle: z.string().min(1).max(250).optional(),
  body: z.string().min(1).max(200000).optional(),
  pageKind: z.enum(PAGE_KINDS as unknown as [string, ...string[]]).optional(),
}).strict();
export type UpdatePageDto = z.infer<typeof UpdatePageSchema>;
