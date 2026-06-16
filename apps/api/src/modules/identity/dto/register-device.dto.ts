import { z } from 'zod';
export const RegisterDeviceSchema = z.object({
  fingerprint: z.string().min(8).max(200),
  platform: z.enum(['android','ios','web']).optional(),
  model: z.string().max(100).optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(20).optional(),
  pushToken: z.string().max(300).optional(),
}).strict();
export type RegisterDeviceDto = z.infer<typeof RegisterDeviceSchema>;
