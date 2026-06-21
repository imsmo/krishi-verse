// apps/admin-api/src/modules/platform-reports/dto/platform-reports.dto.ts · zod .strict() query schemas for the
// read-only exec dashboards (reject unknown keys). Windows are optional ISO timestamps (validated + bounded in the
// domain via resolveWindow); currency is ISO-4217. No mutations here — pure reads.
import { z } from 'zod';

const Iso = z.string().datetime().optional();
const Currency = z.string().regex(/^[A-Z]{3}$/).default('INR');

export const QueryWindowSchema = z.object({ from: Iso, to: Iso, currency: Currency }).strict();
export type QueryWindowDto = z.infer<typeof QueryWindowSchema>;

export const QueryGmvSchema = z.object({ from: Iso, to: Iso, tenantId: z.string().uuid().optional(), currency: Currency }).strict();
export type QueryGmvDto = z.infer<typeof QueryGmvSchema>;

export const QueryTenantGrowthSchema = z.object({ from: Iso, to: Iso }).strict();
export type QueryTenantGrowthDto = z.infer<typeof QueryTenantGrowthSchema>;

export const QueryRegulatorSchema = z.object({ from: Iso, to: Iso, currency: Currency }).strict();
export type QueryRegulatorDto = z.infer<typeof QueryRegulatorSchema>;
