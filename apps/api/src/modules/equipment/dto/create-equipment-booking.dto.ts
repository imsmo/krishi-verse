// modules/equipment/dto/create-equipment-booking.dto.ts · zod .strict() rental lifecycle payloads.
// quantities are decimal strings (parsed to scaled integers; no float). rate/total are server-resolved.
import { z } from 'zod';
import { RATE_BASES } from '../domain/equipment.events';
const minorStr = z.string().regex(/^\d{1,15}$/);
const qtyStr = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, 'quantity, up to 2 decimals');
export const RequestBookingSchema = z.object({
  assetId: z.string().uuid(),
  rateBasis: z.enum(RATE_BASES as unknown as [string, ...string[]]),
  estQuantity: qtyStr,
  scheduledAt: z.string().datetime(),
  taskDesc: z.string().max(250).optional(),
}).strict();
export type RequestBookingDto = z.infer<typeof RequestBookingSchema>;

export const QuoteBookingSchema = z.object({ advanceMinor: minorStr }).strict();
export type QuoteBookingDto = z.infer<typeof QuoteBookingSchema>;

export const StartBookingSchema = z.object({ otp: z.string().min(4).max(12) }).strict();
export type StartBookingDto = z.infer<typeof StartBookingSchema>;

export const CompleteBookingSchema = z.object({ actualQuantity: qtyStr }).strict();
export type CompleteBookingDto = z.infer<typeof CompleteBookingSchema>;
