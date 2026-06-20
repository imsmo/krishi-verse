// modules/education/dto/mark-lesson-progress.dto.ts · zod .strict() — record progress on a lesson.
import { z } from 'zod';
export const MarkProgressSchema = z.object({
  secondsWatched: z.coerce.number().int().min(0).max(86400).default(0),
  quizScore: z.coerce.number().min(0).max(100).nullish(),
  completed: z.boolean().default(false),
}).strict();
export type MarkProgressDto = z.infer<typeof MarkProgressSchema>;
