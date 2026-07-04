// apps/mobile/src/features/labour/insurance-claim.ts · PURE logic for the worker File-Insurance-Claim screen (146).
// No React / no SDK I/O → unit-tested. It holds the claim-type options, the required-document checklist, and the
// incident-form validators.
// §13: there is NO PMSBY claim / policy / document-upload endpoint in the contract yet → the screen collects the
// form but Submit/Save-Draft/Upload degrade to a coming-soon notice; no claim id, policy number or FIR status is
// ever fabricated.

/** Claim types, in design order → i18n `insuranceClaim.type.<key>.title` / `.sub`. */
export const CLAIM_TYPES = [
  { key: 'injury', icon: '🚑' },
  { key: 'death', icon: '⚱' },
] as const;
export type ClaimTypeKey = (typeof CLAIM_TYPES)[number]['key'];

/** Supporting documents, in design order. `required` drives the `*` marker + submit gate. */
export const CLAIM_DOCS = [
  { key: 'fir', icon: '📄', required: false },
  { key: 'hospital', icon: '🏥', required: true },
  { key: 'disability', icon: '📋', required: true },
] as const;
export type ClaimDocKey = (typeof CLAIM_DOCS)[number]['key'];

/** Trim + collapse the incident description, cap length, empty → null. Pure. */
export function normalizeClaimText(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s.slice(0, 2000);
}

/** A date string is present + shaped like YYYY-MM-DD (client UX check; the server re-validates). Pure. */
export function isIncidentDateValid(raw: string | null | undefined): boolean {
  const s = (raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Submit enables once a claim type is chosen, the incident date is well-formed, and a description of ≥10 chars is
 * written (support needs detail to act). Pure. Document uploads have no endpoint yet (§13) so they don't gate here. */
export function canSubmitClaim(
  type: ClaimTypeKey | null | undefined,
  dateIso: string | null | undefined,
  description: string | null | undefined,
): boolean {
  const okType = !!type && CLAIM_TYPES.some((c) => c.key === type);
  return okType && isIncidentDateValid(dateIso) && (normalizeClaimText(description)?.length ?? 0) >= 10;
}
