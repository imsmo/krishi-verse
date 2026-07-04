// modules/labour/dto/create-labour-booking.dto.ts · zod .strict() employer "post a booking" payload.
// The employer supplies the demand type, skill, region + skill_level (used to resolve the statutory
// dignity floor), dates, and the OFFERED wage (minor-unit string, bigint). min_wage is NOT client-
// supplied — the service snapshots it from minimum_wages. wageOffered below the floor is rejected (422).
import { z } from 'zod';
import { WAGE_KINDS, SKILL_LEVELS } from '../domain/labour.events';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a positive integer (minor units)');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
export const CreateBookingSchema = z.object({
  demandTypeCode: z.string().min(1).max(40),
  taskSkillId: z.string().uuid(),
  regionId: z.string().uuid(),                 // statutory floor region (state-level)
  skillLevel: z.enum(SKILL_LEVELS as unknown as [string, ...string[]]),
  workersNeeded: z.number().int().min(1).max(500),
  startDate: dateStr,
  endDate: dateStr,
  dailyHours: z.number().min(0).max(24).default(8),
  wageKind: z.enum(WAGE_KINDS as unknown as [string, ...string[]]).default('per_day'),
  wageOfferedMinor: minorStr,
  womenOnly: z.boolean().default(false),
  farmLat: z.number().min(-90).max(90),
  farmLng: z.number().min(-180).max(180),
  respondByHours: z.number().int().min(1).max(720).optional(),
  // P0-2 booking details (both optional): work start time-of-day + free-text special instructions to the worker.
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM').optional(),
  notes: z.string().max(300).optional(),
}).strict();
export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
