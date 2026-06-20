// modules/education/dto/create-course.dto.ts · zod .strict() — author + edit a course. priceMinor as minor-string.
import { z } from 'zod';
import { COURSE_LEVELS } from '../domain/education.events';
const minor = z.string().regex(/^\d{1,15}$/);
export const CreateCourseSchema = z.object({
  defaultTitle: z.string().min(1).max(250),
  topicId: z.string().uuid().nullish(),
  audienceRoleIds: z.array(z.string().uuid()).max(20).default([]),
  level: z.enum(COURSE_LEVELS as unknown as [string, ...string[]]).default('basic'),
  priceMinor: minor.default('0'),
  certEnabled: z.boolean().default(false),
  coverMediaId: z.string().uuid().nullish(),
}).strict();
export type CreateCourseDto = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = z.object({
  defaultTitle: z.string().min(1).max(250).optional(),
  topicId: z.string().uuid().nullish(),
  audienceRoleIds: z.array(z.string().uuid()).max(20).optional(),
  level: z.enum(COURSE_LEVELS as unknown as [string, ...string[]]).optional(),
  priceMinor: minor.optional(),
  certEnabled: z.boolean().optional(),
  coverMediaId: z.string().uuid().nullish(),
}).strict();
export type UpdateCourseDto = z.infer<typeof UpdateCourseSchema>;
