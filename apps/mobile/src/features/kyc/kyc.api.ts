// apps/mobile/src/features/kyc/kyc.api.ts · KYC data layer. Lists the caller's KYC docs + statuses + the doc-type
// catalogue (reads, degrade-never-die) and submits a new doc (idempotent). A submission references an uploaded
// media id (the doc photo, via core/media) — raw doc numbers are NEVER sent (only an optional masked value). The
// eKYC (Aadhaar/PAN provider) flow lives on the SDK too; review/verification is server/admin-only.
import type { KycDocument, KycDocType } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

/** The caller's KYC documents + statuses. Degrades to [] on failure. */
export async function listKyc(status?: string): Promise<KycDocument[]> {
  try { return await apiClient().kyc.list(status); }
  catch { return []; }
}

/** The seeded KYC document-type catalogue (id + code + localized name) to enumerate uploadable docs (screen 133).
 * Degrades to [] so the Documents section simply shows nothing rather than crashing. */
export async function kycDocTypes(): Promise<KycDocType[]> {
  try { return await apiClient().kyc.docTypes(); }
  catch { return []; }
}

/** Submit a KYC document (docTypeId + uploaded mediaId). Idempotent. Throws on a real client/validation error. */
export async function submitKyc(input: { docTypeId: string; mediaId: string; roleId?: string; docNoMasked?: string }): Promise<{ id: string }> {
  return apiClient().kyc.submit(input, newId());
}
