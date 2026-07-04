// apps/mobile/src/features/labour/pmsby-enroll.ts · PURE logic for the worker PMSBY-enrolment screen (145). No
// React / no SDK I/O (SDK types are `import type` → erased) → unit-tested. It holds the PMSBY statutory money
// constants (public government-scheme facts — same for every worker, bigint minor per Law 2 — NOT per-user data),
// the nominee-relationship options, the nominee-form validators (name/optional-Aadhaar), and the REAL eligibility
// derivation from the worker profile + bank accounts + verified Aadhaar KYC.
// §13: there is NO PMSBY enrolment / policy / nominee endpoint in the contract yet → the screen collects the form
// but the "Enroll" CTA degrades to a coming-soon notice; nothing is faked and no per-user policy is invented.
import type { WorkerProfile, BankAccount, KycDocument, KycDocType } from '@krishi-verse/sdk-js';

// PMSBY statutory figures (public scheme constants — bigint minor, Law 2; not per-user/seed data).
export const PMSBY_COVER_MINOR = '20000000';   // ₹2,00,000 accidental death / total disability
export const PMSBY_PARTIAL_MINOR = '10000000'; // ₹1,00,000 partial disability
export const PMSBY_PREMIUM_MINOR = '2000';     // ₹20 / year

/** Nominee relationship options, in design order → i18n `pmsbyEnroll.rel.<key>`. */
export const NOMINEE_RELATIONSHIPS = ['spouse', 'father', 'mother', 'son', 'daughter', 'sibling', 'other'] as const;
export type NomineeRelationship = (typeof NOMINEE_RELATIONSHIPS)[number];

/** Trim + collapse the nominee name, cap length, empty → null. Pure. */
export function normalizeNomineeName(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s.slice(0, 100);
}

/** Keep only digits, cap at 12 (an Aadhaar number). Pure. Never stored raw beyond this transient field (§4). */
export function normalizeAadhaar(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, 12);
}

/** Aadhaar is OPTIONAL here: valid when blank OR exactly 12 digits. Pure. */
export function isAadhaarValidOptional(raw: string | null | undefined): boolean {
  const d = normalizeAadhaar(raw);
  return d.length === 0 || d.length === 12;
}

/** Enroll enables once a nominee name + a valid relationship are set and any Aadhaar entered is well-formed. Pure. */
export function canEnroll(name: string | null | undefined, rel: NomineeRelationship | null | undefined, aadhaar?: string | null): boolean {
  const okName = !!normalizeNomineeName(name);
  const okRel = !!rel && NOMINEE_RELATIONSHIPS.some((r) => r === rel);
  return okName && okRel && isAadhaarValidOptional(aadhaar);
}

export interface PmsbyEligibility { ageOk: boolean; bankOk: boolean; aadhaarOk: boolean; qualifies: boolean; }

/** REAL eligibility: 18+ (age-verified worker), a linked bank account (auto-debit source), and a verified Aadhaar
 * KYC doc. All three → qualifies. Pure. */
export function pmsbyEligibility(
  worker: WorkerProfile | null | undefined,
  banks: readonly BankAccount[] | null | undefined,
  docTypes: readonly KycDocType[] | null | undefined,
  kyc: readonly KycDocument[] | null | undefined,
): PmsbyEligibility {
  const ageOk = !!worker?.ageVerified18;
  const bankOk = (banks ?? []).some((b) => b.accountKind === 'bank');
  const aadhaarType = (docTypes ?? []).find((d) => d.code.toLowerCase().includes('aadhaar'));
  const aadhaarOk = !!aadhaarType && (kyc ?? []).some((k) => k.docTypeId === aadhaarType.id && k.status === 'verified');
  return { ageOk, bankOk, aadhaarOk, qualifies: ageOk && bankOk && aadhaarOk };
}
