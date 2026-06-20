// modules/education/dto/create-resource.dto.ts · zod .strict() — publish a curated resource.
import { z } from 'zod';
import { RESOURCE_KINDS } from '../domain/creator.events';
export const CreateResourceSchema = z.object({
  channelId: z.string().uuid().nullish(),
  kind: z.enum(RESOURCE_KINDS as unknown as [string, ...string[]]),
  title: z.string().min(1).max(250),
  externalUrl: z.string().url().max(500).nullish(),
  mediaId: z.string().uuid().nullish(),
  topicId: z.string().uuid().nullish(),
  languageCode: z.string().min(2).max(8).nullish(),
  body: z.string().max(20000).nullish(),
}).strict().refine((v) => !!(v.externalUrl || v.mediaId), { message: 'a resource needs an external_url or a media file' });
export type CreateResourceDto = z.infer<typeof CreateResourceSchema>;
