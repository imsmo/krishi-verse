// modules/warehousing/dto/create-nwr-receipt.dto.ts · zod .strict() eNWR issuance payload.
import { z } from 'zod';
import { NWR_REPOSITORIES } from '../domain/warehousing.events';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a positive integer (minor units)');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IssueNwrSchema = z.object({
  storageBookingId: z.string().uuid(),
  repository: z.enum(NWR_REPOSITORIES as unknown as [string, ...string[]]),
  enwrNo: z.string().min(3).max(60),
  valuationMinor: minorStr,
  expiresAt: dateStr.optional(),
}).strict();
export type IssueNwrDto = z.infer<typeof IssueNwrSchema>;
