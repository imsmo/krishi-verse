// modules/cms/dto/query-cms-page.dto.ts · zod .strict() — list pages (admin keyset).
import { z } from 'zod';
import { PAGE_KINDS, PAGE_STATUSES } from '../domain/cms.events';
export const QueryPagesSchema = z.object({
  pageKind: z.enum(PAGE_KINDS as unknown as [string, ...string[]]).optional(),
  status: z.enum(PAGE_STATUSES as unknown as [string, ...string[]]).optional(),
  slug: z.string().max(150).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryPagesDto = z.infer<typeof QueryPagesSchema>;
