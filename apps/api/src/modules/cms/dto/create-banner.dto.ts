// modules/cms/dto/create-banner.dto.ts · zod .strict() — schedule a banner.
import { z } from 'zod';
export const CreateBannerSchema = z.object({
  placement: z.string().min(1).max(40),
  mediaId: z.string().uuid(),
  languageCode: z.string().min(2).max(8).nullish(),
  targetUrl: z.string().url().max(400).nullish(),
  audienceRules: z.record(z.unknown()).default({}),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
}).strict();
export type CreateBannerDto = z.infer<typeof CreateBannerSchema>;
