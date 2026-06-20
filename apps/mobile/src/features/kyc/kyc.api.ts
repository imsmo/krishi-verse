// apps/mobile/src/features/kyc/kyc.api.ts · KYC data layer. Lists the caller's KYC docs + statuses (read,
// degrade-never-die) and submits a new doc (idempotent). A submission references an uploaded media id (the doc
// photo, via core/media) — raw doc numbers are NEVER sent (only a masked value). Review is server/admin-only.
//
// FLAGGED BACKEND GAP: submitting requires a `docTypeId` (uuid), but the API does not yet expose a doc-type
// lookup endpoint. Until it does, the SUBMIT screen can't enumerate types, so this release ships KYC STATUS
// (list) only; submit() is wired to the real contract and ready for when the lookup lands.
import type { KycDocument } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

/** The caller's KYC documents + statuses. Degrades to [] on failure. */
export async function listKyc(status?: string): Promise<KycDocument[]> {
  try { return await apiClient().kyc.list(status); }
  catch { return []; }
}

/** Submit a KYC document (docTypeId + uploaded mediaId). Idempotent. Throws on a real client/validation error. */
export async function submitKyc(input: { docTypeId: string; mediaId: string; roleId?: string; docNoMasked?: string }): Promise<{ id: string }> {
  return apiClient().kyc.submit(input, newId());
}
