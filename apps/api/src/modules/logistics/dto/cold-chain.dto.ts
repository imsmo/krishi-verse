// modules/logistics/dto/cold-chain.dto.ts · record a reefer/vaccine temperature reading + query the trail (zod
// .strict). Temperatures are physical decimals (NOT money). The allowed band drives is_breach in the domain.
import { z } from 'zod';
import { COLD_CHAIN_SUBJECTS } from '../domain/cold-chain-log.entity';

const Temp = z.number().min(-60).max(80);

export const RecordColdChainSchema = z.object({
  subjectType: z.enum(COLD_CHAIN_SUBJECTS),
  subjectId: z.string().uuid(),
  tempC: Temp,
  humidityPct: z.number().min(0).max(100).nullable().optional(),
  deviceRef: z.string().trim().min(1).max(100).nullable().optional(),
  recordedAt: z.string().datetime(),                 // ISO-8601 device timestamp
  allowedMinC: Temp,
  allowedMaxC: Temp,
}).strict().refine((d) => d.allowedMinC <= d.allowedMaxC, { message: 'allowedMinC must be <= allowedMaxC' });
export type RecordColdChainDto = z.infer<typeof RecordColdChainSchema>;

export const QueryColdChainSchema = z.object({
  subjectType: z.enum(COLD_CHAIN_SUBJECTS),
  subjectId: z.string().uuid(),
  breachOnly: z.coerce.boolean().default(false),
  since: z.string().datetime().optional(),            // recorded_at lower bound (partition prune)
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
}).strict();
export type QueryColdChainDto = z.infer<typeof QueryColdChainSchema>;
