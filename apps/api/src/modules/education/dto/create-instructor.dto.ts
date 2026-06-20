// modules/education/dto/create-instructor.dto.ts · zod .strict() — become/author an instructor profile.
import { z } from 'zod';
export const CreateInstructorSchema = z.object({
  bio: z.string().max(2000).nullish(),
}).strict();
export type CreateInstructorDto = z.infer<typeof CreateInstructorSchema>;
export const UpdateInstructorSchema = z.object({ bio: z.string().max(2000).nullish() }).strict();
export type UpdateInstructorDto = z.infer<typeof UpdateInstructorSchema>;
