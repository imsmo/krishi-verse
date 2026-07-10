// modules/logistics/dto/update-shipment.dto.ts · zod .strict() action payloads (one per lifecycle step).
import { z } from 'zod';

export const AssignShipmentSchema = z.object({
  partnerId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  riderUserId: z.string().uuid().optional(),
  awbNo: z.string().max(60).optional(),
}).strict().refine((v) => v.partnerId || v.vehicleId || v.riderUserId, { message: 'assign at least one of partnerId/vehicleId/riderUserId' });
export type AssignShipmentDto = z.infer<typeof AssignShipmentSchema>;

export const SchedulePickupSchema = z.object({
  scheduledPickupAt: z.string().datetime(),
  windowMins: z.coerce.number().int().min(0).max(1440).optional(),
}).strict();
export type SchedulePickupDto = z.infer<typeof SchedulePickupSchema>;

// proof-of-delivery: the buyer's OTP (4–8 digits) + optional signed POD media id.
export const DeliverShipmentSchema = z.object({
  otp: z.string().regex(/^\d{4,8}$/, 'otp must be 4–8 digits'),
  podMediaId: z.string().uuid().optional(),
}).strict();
export type DeliverShipmentDto = z.infer<typeof DeliverShipmentSchema>;

export const FailShipmentSchema = z.object({ reason: z.string().min(1).max(500) }).strict();
export type FailShipmentDto = z.infer<typeof FailShipmentSchema>;

// rider location ping: append a lat/lng tracking point (no status change). Coordinates are validated
// to real WGS84 ranges; a short optional note (e.g. "at Karjan checkpoint").
export const ShipmentLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  note: z.string().max(200).optional(),
}).strict();
export type ShipmentLocationDto = z.infer<typeof ShipmentLocationSchema>;
