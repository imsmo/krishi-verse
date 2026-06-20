// modules/ambassadors/dto/create-referral.dto.ts · zod .strict() — create a referral code + claim a code.
import { z } from 'zod';
export const CreateReferralSchema = z.object({ code: z.string().regex(/^[A-Z0-9]{4,20}$/) }).strict();
export type CreateReferralDto = z.infer<typeof CreateReferralSchema>;

export const ClaimReferralSchema = z.object({ code: z.string().regex(/^[A-Z0-9]{4,20}$/) }).strict();
export type ClaimReferralDto = z.infer<typeof ClaimReferralSchema>;
