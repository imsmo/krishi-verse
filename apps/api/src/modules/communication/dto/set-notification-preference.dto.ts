// modules/communication/dto/set-notification-preference.dto.ts · zod .strict() — bulk set per event×channel opt-in/out.
import { z } from 'zod';
import { NOTIF_CHANNELS } from '../domain/communication.events';
export const SetPreferencesSchema = z.object({
  preferences: z.array(z.object({
    eventCode: z.string().min(1).max(80),
    channel: z.enum(NOTIF_CHANNELS as unknown as [string, ...string[]]),
    isEnabled: z.boolean(),
  })).min(1).max(200),   // bounded write amplification (§4)
}).strict();
export type SetPreferencesDto = z.infer<typeof SetPreferencesSchema>;
