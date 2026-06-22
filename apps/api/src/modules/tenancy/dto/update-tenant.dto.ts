// modules/tenancy/dto/update-tenant.dto.ts · self-serve tenant PROFILE patch (zod .strict). Only profile fields
// are accepted — slug/tenant_type/country/status/risk_score are NOT in the schema, so .strict() rejects any
// attempt to set them (no mass-assignment / no lifecycle escalation, Law 11). All keys optional; at least one.
import { z } from 'zod';

export const UpdateTenantProfileSchema = z.object({
  legalName: z.string().trim().min(1).max(250).optional(),
  displayName: z.string().trim().min(1).max(150).optional(),
  regionId: z.string().uuid().nullable().optional(),
  gstin: z.string().trim().min(1).max(20).nullable().optional(),
  pan: z.string().trim().min(1).max(15).nullable().optional(),
  cinOrRegNo: z.string().trim().min(1).max(40).nullable().optional(),
  fssaiLicense: z.string().trim().min(1).max(20).nullable().optional(),
  ownerName: z.string().trim().min(1).max(200).nullable().optional(),
  ownerPhone: z.string().trim().min(1).max(20).nullable().optional(),
  ownerEmail: z.string().trim().min(1).max(200).nullable().optional(),
}).strict().refine((d) => Object.keys(d).length > 0, { message: 'at least one profile field is required' });
export type UpdateTenantProfileDto = z.infer<typeof UpdateTenantProfileSchema>;
