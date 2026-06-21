// apps/admin-api/src/modules/compliance-ops/dto/compliance-ops.dto.ts · zod .strict() request schemas (reject
// unknown keys → no mass-assignment). Every mutation carries a reason/resolution (audit/§4). Free-text fields
// are bounded; the audit-explorer filters are charset/length-bounded (ReDoS-safe, parameterised downstream).
import { z } from 'zod';
import { DSR_STATUSES } from '../domain/dsr.state';
import { BREACH_STATUSES } from '../domain/breach.state';

const Text = z.string().min(3).max(2000);
const Cursor = z.string().max(200).optional();
const Limit = z.coerce.number().int().min(1).max(100).default(50);

/* ---- data-subject requests (DPDP rights) ---- */
export const QueryDsrSchema = z.object({
  status: z.enum(DSR_STATUSES).optional(),
  requestType: z.enum(['access', 'erasure', 'correction', 'portability']).optional(),
  cursor: Cursor, limit: Limit,
}).strict();
export type QueryDsrDto = z.infer<typeof QueryDsrSchema>;

export const UpdateDsrSchema = z.object({
  action: z.enum(['start', 'complete', 'reject']),
  resolution: Text,
  exportMediaId: z.string().uuid().nullish(),     // for access/portability fulfilment
}).strict();
export type UpdateDsrDto = z.infer<typeof UpdateDsrSchema>;

/* ---- export approvals ---- */
export const QueryExportsSchema = z.object({
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  jobKind: z.string().max(30).optional(),
  cursor: Cursor, limit: Limit,
}).strict();
export type QueryExportsDto = z.infer<typeof QueryExportsSchema>;

export const DecideExportSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: Text,
}).strict();
export type DecideExportDto = z.infer<typeof DecideExportSchema>;

/* ---- audit-log explorer (read-only) ---- */
export const QueryAuditSchema = z.object({
  actorUserId: z.string().uuid().optional(),
  entityType: z.string().regex(/^[a-z0-9_]{1,60}$/).optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().regex(/^[a-z0-9_.]{1,120}$/).optional(),
  tenantId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),        // partition-prune lower bound
  to: z.string().datetime().optional(),
  cursor: Cursor, limit: Limit,
}).strict();
export type QueryAuditDto = z.infer<typeof QueryAuditSchema>;

/* ---- retention policies (config) ---- */
export const UpsertRetentionSchema = z.object({
  tableName: z.string().regex(/^[a-z0-9_]{2,100}$/),
  activeMonths: z.number().int().min(0).max(1200),
  archiveMonths: z.number().int().min(0).max(1200).nullable(),
  legalBasis: z.string().max(200).nullish(),
  action: z.enum(['archive', 'anonymise', 'delete', 'keep_forever']),
  isActive: z.boolean().default(true),
  reason: Text,
}).strict();
export type UpsertRetentionDto = z.infer<typeof UpsertRetentionSchema>;

/* ---- breach console ---- */
export const QueryBreachesSchema = z.object({
  status: z.enum(BREACH_STATUSES).optional(),
  cursor: Cursor, limit: Limit,
}).strict();
export type QueryBreachesDto = z.infer<typeof QueryBreachesSchema>;

export const OpenBreachSchema = z.object({
  affectedTenantId: z.string().uuid().nullish(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
  title: z.string().min(3).max(200),
  description: Text,
  affectedData: z.string().min(1).max(500),       // categories only (e.g. 'phone,email') — NO raw PII
  affectedCount: z.number().int().min(0).default(0),
  detectedAt: z.string().datetime(),
}).strict();
export type OpenBreachDto = z.infer<typeof OpenBreachSchema>;

export const UpdateBreachSchema = z.object({
  action: z.enum(['contain', 'notify', 'close']),
  note: Text,
  regulatorNotifiedAt: z.string().datetime().optional(),   // required for action='notify'
  principalsNotifiedAt: z.string().datetime().optional(),
}).strict();
export type UpdateBreachDto = z.infer<typeof UpdateBreachSchema>;
