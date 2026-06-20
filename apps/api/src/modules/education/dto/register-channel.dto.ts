// modules/education/dto/register-channel.dto.ts · zod .strict() — register/update an external content channel.
import { z } from 'zod';
import { CHANNEL_PROVIDERS } from '../domain/creator.events';
const url = z.string().url().max(500);
export const RegisterChannelSchema = z.object({
  provider: z.enum(CHANNEL_PROVIDERS as unknown as [string, ...string[]]),
  title: z.string().min(1).max(200),
  handle: z.string().max(120).nullish(),
  externalUrl: url,
  topicId: z.string().uuid().nullish(),
  description: z.string().max(4000).nullish(),
}).strict();
export type RegisterChannelDto = z.infer<typeof RegisterChannelSchema>;

export const UpdateChannelSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  handle: z.string().max(120).nullish(),
  description: z.string().max(4000).nullish(),
  topicId: z.string().uuid().nullish(),
}).strict();
export type UpdateChannelDto = z.infer<typeof UpdateChannelSchema>;

export const ModerateChannelSchema = z.object({ note: z.string().max(1000).nullish() }).strict();
export type ModerateChannelDto = z.infer<typeof ModerateChannelSchema>;
