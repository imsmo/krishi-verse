// apps/web-tenant/src/features/schemes/operator.ts · PURE helpers for the schemes operator/assistant console.
// No framework, no I/O → unit-tested. The SERVER stays authoritative: it runs the application state machine
// (scheme-application.state), evaluates eligibility deterministically, snapshots the scheme version, and records
// observed DBT credits — these helpers only decide which officer actions to OFFER + pre-validate the form. DBT
// amount is a bigint minor-unit STRING (Law 2); regexes are anchored fixed char-classes (ReDoS-safe).

export const APPLICATION_STATUSES = ['draft', 'submitted', 'under_verification', 'clarification_needed', 'approved', 'rejected', 'disbursed', 'closed', 'appealed'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const MINOR = /^\d{1,15}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Which officer (scheme.process) lifecycle actions to OFFER next, mirroring scheme-application.state (Law 5).
 *  submitted → verify; under_verification → clarify/approve/reject; clarification_needed → approve/reject;
 *  approved → close + record DBT; rejected/disbursed/closed/draft/appealed → none here. */
export function officerActions(status: string): Array<'verify' | 'clarify' | 'approve' | 'reject' | 'close'> {
  switch (status) {
    case 'submitted': return ['verify'];
    case 'under_verification': return ['clarify', 'approve', 'reject'];
    case 'clarification_needed': return ['approve', 'reject'];
    case 'approved': return ['close'];
    default: return [];
  }
}

/** Whether the officer may record an observed DBT credit (only after approval / during disbursal). */
export function canRecordDbt(status: string): boolean {
  return status === 'approved' || status === 'disbursed';
}

/** Validate a recorded-DBT form. Returns a field code on the first problem, else null. */
export function validateDbt(input: { amountMinor: string; creditedOn: string; instalmentNo?: string }): string | null {
  if (!MINOR.test(input.amountMinor) || input.amountMinor === '0') return 'amount';
  if (!DATE.test(input.creditedOn)) return 'date';
  if (input.instalmentNo != null && input.instalmentNo !== '') {
    const n = Number(input.instalmentNo);
    if (!Number.isInteger(n) || n < 1 || n > 60) return 'instalment';
  }
  return null;
}

/** Validate the eligibility-checker form (operator runs it on behalf of an applicant). Read-only on the server. */
export function validateEligibility(input: { landholdingAcres?: string; age?: string; gender?: string }): string | null {
  if (input.landholdingAcres != null && input.landholdingAcres !== '') {
    const n = Number(input.landholdingAcres);
    if (!Number.isFinite(n) || n < 0 || n > 100000) return 'landholding';
  }
  if (input.age != null && input.age !== '') {
    const n = Number(input.age);
    if (!Number.isInteger(n) || n < 0 || n > 150) return 'age';
  }
  if (input.gender != null && input.gender !== '' && !['male', 'female', 'other'].includes(input.gender)) return 'gender';
  return null;
}

/** A clarification note is optional but bounded. */
export function validateNote(note?: string): string | null {
  if (note != null && note.length > 1000) return 'note';
  return null;
}

/** Sum recorded DBT credits for an application — a disbursed-total presenter (float-free). */
export function totalDbtMinor(transfers: Array<{ amountMinor: string }>): string {
  let total = 0n;
  for (const d of transfers) if (MINOR.test(d.amountMinor)) total += BigInt(d.amountMinor);
  return total.toString();
}
