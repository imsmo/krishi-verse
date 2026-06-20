// modules/ai-governance/dto/override-ai-inference.dto.ts · zod .strict() — mark an inference as overridden by
// a human (audit trail of when AI was corrected).
import { z } from 'zod';
export const OverrideInferenceSchema = z.object({
  createdAt: z.string().datetime(),                       // the inference's created_at (bounds its partition)
  reason: z.string().min(1).max(500),
}).strict();
export type OverrideInferenceDto = z.infer<typeof OverrideInferenceSchema>;
