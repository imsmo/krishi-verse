// modules/labour/dto/create-booking-assignment.dto.ts · zod .strict() employer "assign a worker" payload.
// The per-worker wage defaults to the booking's offered wage; if overridden it must still clear the floor
// (enforced in the service against the booking's snapshotted min_wage).
import { z } from 'zod';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a positive integer (minor units)');
export const AssignWorkerSchema = z.object({
  workerId: z.string().uuid(),
  wageMinor: minorStr.optional(),
}).strict();
export type AssignWorkerDto = z.infer<typeof AssignWorkerSchema>;

export const RespondAssignmentSchema = z.object({
  decision: z.enum(['accept', 'reject']),
  voiceConsentMediaId: z.string().uuid().optional(),
}).strict();
export type RespondAssignmentDto = z.infer<typeof RespondAssignmentSchema>;
