import { z } from 'zod';
export const UpdateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  gender: z.enum(['male','female','other','undisclosed']).optional(),
  dob: z.string().date().optional(),
  languageCode: z.string().min(2).max(8).optional(),
  email: z.string().email().max(200).optional(),
  photoMediaId: z.string().uuid().optional(),
}).strict();
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
