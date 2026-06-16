import { z } from 'zod';
// Admin/ambassador-assisted user creation (e.g. onboarding a farmer who can't self-register).
export const CreateUserSchema = z.object({
  phone: z.string().min(8).max(20),
  fullName: z.string().trim().min(1).max(200).optional(),
  languageCode: z.string().min(2).max(8).default('hi'),
  countryCode: z.string().length(2).default('IN'),
}).strict();
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
