import { z } from 'zod';
// Register / revoke a push device. platform is a closed enum (matches the DB CHECK + the PushDevice
// domain). token is the opaque Expo/FCM push token (bounded; never logged). The domain re-validates.
export const RegisterDeviceSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  token: z.string().min(1).max(512),
}).strict();
export type RegisterDeviceDto = z.infer<typeof RegisterDeviceSchema>;

export const RevokeDeviceSchema = z.object({
  token: z.string().min(1).max(512),
}).strict();
export type RevokeDeviceDto = z.infer<typeof RevokeDeviceSchema>;
