import { z } from 'zod';
export const SubmitKycSchema = z.object({
  roleId: z.string().uuid().optional(),
  docTypeId: z.string().uuid(),
  mediaId: z.string().uuid(),
  docNoMasked: z.string().max(50).optional(),
  issuedBy: z.string().max(150).optional(),
  validFrom: z.string().date().optional(),
  validUntil: z.string().date().optional(),
}).strict();
export type SubmitKycDto = z.infer<typeof SubmitKycSchema>;

export const ReviewKycSchema = z.object({
  decision: z.enum(['verify','reject']),
  reason: z.string().max(500).optional(),
}).strict().refine((v) => v.decision !== 'reject' || (v.reason && v.reason.length > 0), { message: 'reason required when rejecting' });
export type ReviewKycDto = z.infer<typeof ReviewKycSchema>;
