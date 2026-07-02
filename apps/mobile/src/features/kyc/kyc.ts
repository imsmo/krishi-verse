// apps/mobile/src/features/kyc/kyc.ts · PURE KYC presentation logic (no React/native; SDK types are `import type`
// → erased) → unit-tested. Maps the caller's submitted docs onto the doc-type catalogue for the upload screen.
import type { KycDocument, KycStatus } from '@krishi-verse/sdk-js';

/** The status of the caller's most-recent submission for a given doc type, or null if they haven't submitted one.
 * Drives each Documents row on screen 133 (Uploaded/Verified/Pending vs an empty "Upload" affordance). Pure. */
export function kycStatusFor(docs: ReadonlyArray<Pick<KycDocument, 'docTypeId' | 'status'>>, docTypeId: string): KycStatus | null {
  const d = docs.find((x) => x.docTypeId === docTypeId);
  return d ? d.status : null;
}
