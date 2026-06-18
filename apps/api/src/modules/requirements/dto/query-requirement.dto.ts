// modules/requirements/dto/query-requirement.dto.ts · list/filter query params (cursor pagination, never OFFSET).
import { z } from 'zod';
import { REQUIREMENT_STATUSES } from '../domain/requirement.state';

// box=open → browse open requirements (sellers); box=mine → the buyer's own requirements.
export const REQUIREMENT_BOXES = ['open', 'mine'] as const;
export type RequirementBox = (typeof REQUIREMENT_BOXES)[number];

export const QueryRequirementsSchema = z.object({
  box: z.enum(REQUIREMENT_BOXES).default('open'),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  categoryId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type QueryRequirementsDto = z.infer<typeof QueryRequirementsSchema>;
