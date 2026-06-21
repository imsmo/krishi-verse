// apps/admin-api/src/modules/schemes-registry-ops/dto/schemes-registry.dto.ts · zod .strict() request schemas
// (reject unknown keys → no mass-assignment). Every mutation carries a mandatory reason. Shapes are bounded here
// AND re-validated in the domain (defence in depth). processing_fee_minor is a DIGIT STRING → bigint (never a
// float, Law 2). The JSON blobs are passed through (domain bounds + validates them).
import { z } from 'zod';
import { AUTHORITY_LEVELS } from '../domain/scheme-rules';

const Reason = z.string().min(3).max(1000);
const Cursor = z.string().max(200).optional();
const Limit = z.coerce.number().int().min(1).max(100).default(50);
const Uuid = z.string().uuid();
const Code = z.string().min(2).max(60).regex(/^[a-z][a-z0-9_]{1,59}$/);
const SchemeName = z.string().min(1).max(250);
const AuthorityName = z.string().min(1).max(200);
const FeeMinor = z.string().regex(/^\d{1,15}$/, 'minor units as a non-negative integer string');
const JsonObject = z.record(z.unknown());
const UuidArray = z.array(Uuid);
const MmDd = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const Window = z.object({ opens: MmDd, closes: MmDd, season: z.string().regex(/^[a-z_]{1,20}$/).optional() }).strict();
const SourceUrl = z.string().max(400).url();

/* ---------------- authorities ---------------- */
export const CreateAuthoritySchema = z.object({
  defaultName: AuthorityName,
  level: z.enum(AUTHORITY_LEVELS),
  regionId: Uuid.nullable().optional(),
  reason: Reason,
}).strict();
export type CreateAuthorityDto = z.infer<typeof CreateAuthoritySchema>;

export const UpdateAuthoritySchema = z.object({
  defaultName: AuthorityName.optional(),
  level: z.enum(AUTHORITY_LEVELS).optional(),
  regionId: Uuid.nullable().optional(),
  reason: Reason,
}).strict().refine((d) => d.defaultName !== undefined || d.level !== undefined || d.regionId !== undefined, { message: 'at least one of defaultName/level/regionId is required' });
export type UpdateAuthorityDto = z.infer<typeof UpdateAuthoritySchema>;

/* ---------------- schemes ---------------- */
export const CreateSchemeSchema = z.object({
  code: Code,
  defaultName: SchemeName,
  authorityId: Uuid,
  categoryId: Uuid,
  benefitSummary: JsonObject,
  eligibilityRules: JsonObject,
  requiredDocTypeIds: UuidArray.default([]),
  applicationWindow: Window.nullable().optional(),
  applicableRegionIds: UuidArray.default([]),
  processingFeeMinor: FeeMinor.default('0'),
  sourceUrl: SourceUrl.nullable().optional(),
  reason: Reason,
}).strict();
export type CreateSchemeDto = z.infer<typeof CreateSchemeSchema>;

export const UpdateSchemeMetaSchema = z.object({
  defaultName: SchemeName.optional(),
  authorityId: Uuid.optional(),
  categoryId: Uuid.optional(),
  sourceUrl: SourceUrl.nullable().optional(),
  reason: Reason,
}).strict().refine((d) => ['defaultName', 'authorityId', 'categoryId', 'sourceUrl'].some((k) => (d as Record<string, unknown>)[k] !== undefined), { message: 'at least one mutable meta field is required' });
export type UpdateSchemeMetaDto = z.infer<typeof UpdateSchemeMetaSchema>;

export const UpdateSchemeRulesSchema = z.object({
  benefitSummary: JsonObject.optional(),
  eligibilityRules: JsonObject.optional(),
  requiredDocTypeIds: UuidArray.optional(),
  applicableRegionIds: UuidArray.optional(),
  processingFeeMinor: FeeMinor.optional(),
  reason: Reason,
}).strict().refine((d) => ['benefitSummary', 'eligibilityRules', 'requiredDocTypeIds', 'applicableRegionIds', 'processingFeeMinor'].some((k) => (d as Record<string, unknown>)[k] !== undefined), { message: 'at least one rule field is required' });
export type UpdateSchemeRulesDto = z.infer<typeof UpdateSchemeRulesSchema>;

export const SetWindowSchema = z.object({ applicationWindow: Window.nullable(), reason: Reason }).strict();
export type SetWindowDto = z.infer<typeof SetWindowSchema>;

export const SetActiveSchema = z.object({ isActive: z.boolean(), reason: Reason }).strict();
export type SetActiveDto = z.infer<typeof SetActiveSchema>;

/* ---------------- queries ---------------- */
export const QueryAuthoritiesSchema = z.object({ level: z.enum(AUTHORITY_LEVELS).optional(), cursor: Cursor, limit: Limit }).strict();
export type QueryAuthoritiesDto = z.infer<typeof QueryAuthoritiesSchema>;

export const QuerySchemesSchema = z.object({
  authorityId: Uuid.optional(),
  categoryId: Uuid.optional(),
  isActive: z.enum(['true', 'false']).optional(),
  cursor: Cursor,
  limit: Limit,
}).strict();
export type QuerySchemesDto = z.infer<typeof QuerySchemesSchema>;

export const QueryCalendarSchema = z.object({
  onDate: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).optional(),   // 'MM-DD'; default = today
  cursor: Cursor,
  limit: Limit,
}).strict();
export type QueryCalendarDto = z.infer<typeof QueryCalendarSchema>;

export const QueryChangesSchema = z.object({ cursor: Cursor, limit: Limit }).strict();
export type QueryChangesDto = z.infer<typeof QueryChangesSchema>;
