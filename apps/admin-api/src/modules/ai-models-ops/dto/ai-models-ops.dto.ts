// apps/admin-api/src/modules/ai-models-ops/dto/ai-models-ops.dto.ts · zod .strict() request schemas (reject
// unknown keys → no mass-assignment). Shared by the controller; parsed before any business logic runs.
import { z } from 'zod';
import { MODEL_STATUSES } from '../domain/ai-model.state';

export const RegisterModelSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]{2,80}$/),
  version: z.string().min(1).max(30),
  provider: z.string().max(60).nullish(),
  confidenceThreshold: z.number().min(0).max(1).nullish(),
}).strict();
export type RegisterModelDto = z.infer<typeof RegisterModelSchema>;

export const PromoteModelSchema = z.object({
  to: z.enum(MODEL_STATUSES),
  reason: z.string().min(1).max(500),
}).strict();
export type PromoteModelDto = z.infer<typeof PromoteModelSchema>;

export const TuneThresholdSchema = z.object({
  confidenceThreshold: z.number().min(0).max(1).nullable(),
  reason: z.string().min(1).max(500),
}).strict();
export type TuneThresholdDto = z.infer<typeof TuneThresholdSchema>;

export const QueryModelsSchema = z.object({
  code: z.string().max(80).optional(),
  status: z.enum(MODEL_STATUSES).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryModelsDto = z.infer<typeof QueryModelsSchema>;
