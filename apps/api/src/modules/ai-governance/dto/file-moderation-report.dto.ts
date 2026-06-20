// modules/ai-governance/dto/file-moderation-report.dto.ts · zod .strict() — report a piece of content.
// reasonCode resolves to a 'report_reason' lookup value (seeded). Any authenticated user may file.
import { z } from 'zod';
export const FileReportSchema = z.object({
  subjectType: z.enum(['listing', 'review', 'message', 'user', 'resource', 'channel', 'live_session']),
  subjectId: z.string().uuid(),
  reasonCode: z.string().min(1).max(60),
  details: z.string().max(1000).nullish(),
}).strict();
export type FileReportDto = z.infer<typeof FileReportSchema>;
