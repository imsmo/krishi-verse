// modules/identity/dto/ekyc.dto.ts · eKYC start + verify request bodies (zod .strict — reject unknown keys).
// The raw idNumber is accepted ONLY here and handed straight to the service → provider; it is never persisted.
import { z } from 'zod';

export const StartEkycSchema = z.object({
  docType: z.enum(['aadhaar', 'pan']),
  // 12 digits (optionally space-grouped) for Aadhaar, or a 10-char PAN. Checksum validated in the domain layer.
  idNumber: z.string().trim().min(10).max(20),
  fullName: z.string().trim().max(140).optional(),
}).strict();
export type StartEkycDto = z.infer<typeof StartEkycSchema>;

export const VerifyEkycSchema = z.object({
  sessionId: z.string().uuid(),
  otp: z.string().trim().min(4).max(8).regex(/^\d+$/, 'otp must be digits'),
}).strict();
export type VerifyEkycDto = z.infer<typeof VerifyEkycSchema>;
