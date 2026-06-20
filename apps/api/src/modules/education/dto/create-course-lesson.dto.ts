// modules/education/dto/create-course-lesson.dto.ts · zod .strict() — add/edit a lesson.
import { z } from 'zod';
import { CONTENT_KINDS } from '../domain/education.events';
export const UpsertLessonSchema = z.object({
  moduleNo: z.coerce.number().int().min(1).max(999).default(1),
  lessonNo: z.coerce.number().int().min(1).max(999),
  defaultTitle: z.string().min(1).max(250),
  contentKind: z.enum(CONTENT_KINDS as unknown as [string, ...string[]]),
  mediaId: z.string().uuid().nullish(),
  body: z.string().max(20000).nullish(),
  durationSecs: z.coerce.number().int().min(0).max(86400).nullish(),
  quiz: z.any().optional(),
}).strict();
export type UpsertLessonDto = z.infer<typeof UpsertLessonSchema>;
