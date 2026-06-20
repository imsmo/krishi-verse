// modules/traceability/dto/create-trace-event.dto.ts · zod .strict() — append a journey event.
import { z } from 'zod';
import { TRACE_STEPS } from '../domain/traceability.events';
export const AppendEventSchema = z.object({
  eventCode: z.enum(TRACE_STEPS as unknown as [string, ...string[]]),
  meta: z.record(z.unknown()).default({}),
}).strict();
export type AppendEventDto = z.infer<typeof AppendEventSchema>;
