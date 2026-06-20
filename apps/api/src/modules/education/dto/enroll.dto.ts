// modules/education/dto/enroll.dto.ts · zod .strict() — enroll in a course.
import { z } from 'zod';
export const EnrollBodySchema = z.object({ courseId: z.string().uuid() }).strict();
export type EnrollBodyDto = z.infer<typeof EnrollBodySchema>;
