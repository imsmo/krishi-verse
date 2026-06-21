// apps/mobile/src/features/schemes/schemes.ts · PURE govt-schemes logic for P-21. No React/native (SDK/ui types are
// `import type` → erased) → unit-tested. The SERVER is the authority on eligibility, on the application state
// machine, and on DBT credits — these helpers only drive the UI: status tone/labels, which applicant actions a
// status allows, the document checklist completeness, and apply/eligibility input assembly + validation.
import type { PillTone } from '@krishi-verse/ui-native';
import type { ApplicationStatus, EligibilityResult } from '@krishi-verse/sdk-js';

/** Status → tone for the pill (UX only; the server owns the real state machine). */
export function applicationStatusTone(status: ApplicationStatus | string): PillTone {
  switch (status) {
    case 'approved': case 'disbursed': return 'success';
    case 'rejected': return 'danger';
    case 'clarification_needed': case 'appealed': return 'warning';
    case 'submitted': case 'under_verification': return 'info';
    case 'closed': return 'neutral';
    default: return 'neutral'; // draft + unknown
  }
}

/** A draft can be submitted; a rejected/clarification app can be resubmitted; a rejected app can be appealed.
 * These gate the UI only — the server re-checks the transition (Law 5/11) and a 4xx surfaces gracefully. */
export function canSubmit(status: ApplicationStatus | string): boolean { return status === 'draft'; }
export function canResubmit(status: ApplicationStatus | string): boolean { return status === 'clarification_needed' || status === 'rejected'; }
export function canAppeal(status: ApplicationStatus | string): boolean { return status === 'rejected'; }

/** Eligibility summary for the UI: eligible flag + how many blocking reasons (0 when eligible). */
export function eligibilitySummary(result: EligibilityResult | null | undefined): { eligible: boolean; reasonCount: number } {
  if (!result) return { eligible: false, reasonCount: 0 };
  return { eligible: !!result.eligible, reasonCount: result.reasons?.length ?? 0 };
}

/** Normalize + bound the eligibility-check inputs the farmer enters (server re-validates, zod .strict). Drops
 * blanks so an empty field isn't sent as 0/"" (which would skew the rules). */
export interface EligibilityForm { roles?: string[]; landholdingAcres?: string; gender?: string; age?: string }
export interface EligibilityInput { roles?: string[]; landholdingAcres?: number; gender?: 'male' | 'female' | 'other'; age?: number }
export function buildEligibilityInput(form: EligibilityForm): EligibilityInput {
  const out: EligibilityInput = {};
  if (form.roles && form.roles.length) out.roles = form.roles.slice(0, 20);
  const acres = parseNonNeg(form.landholdingAcres, 100000);
  if (acres != null) out.landholdingAcres = acres;
  if (form.gender === 'male' || form.gender === 'female' || form.gender === 'other') out.gender = form.gender;
  const age = parseInt0to150(form.age);
  if (age != null) out.age = age;
  return out;
}
function parseNonNeg(raw: string | undefined, max: number): number | undefined {
  const s = (raw ?? '').trim(); if (!s) return undefined;
  const n = Number(s); if (!Number.isFinite(n) || n < 0 || n > max) return undefined; return n;
}
function parseInt0to150(raw: string | undefined): number | undefined {
  const s = (raw ?? '').trim(); if (!/^\d{1,3}$/.test(s)) return undefined;
  const n = parseInt(s, 10); if (n < 0 || n > 150) return undefined; return n;
}

// --- document checklist (attach required docs before applying) ---
export interface DocItem { docTypeId: string; index: number; mediaId: string | null }
/** Build the checklist rows from a scheme's requiredDocTypeIds + the uploaded {docTypeId→mediaId} map. */
export function docChecklist(requiredDocTypeIds: string[], uploaded: Record<string, string>): DocItem[] {
  return (requiredDocTypeIds ?? []).map((docTypeId, index) => ({ docTypeId, index, mediaId: uploaded[docTypeId] ?? null }));
}
export function allDocsUploaded(requiredDocTypeIds: string[], uploaded: Record<string, string>): boolean {
  return (requiredDocTypeIds ?? []).every((id) => !!uploaded[id]);
}

// --- apply draft assembly ---
export interface ApplyForm { schemeId?: string; requiredDocTypeIds?: string[]; uploaded?: Record<string, string>; consent?: boolean }
export interface ApplyDraft { ok: boolean; input?: { schemeId: string; formData: { documents: Array<{ docTypeId: string; mediaId: string }> } }; reason?: 'scheme' | 'consent' | 'documents' }
/** Validate + assemble the apply payload. Requires a scheme, consent, and every required doc uploaded. The
 * document refs go into formData.documents (the server stores formData; there's no separate doc endpoint). */
export function buildApplyDraft(form: ApplyForm): ApplyDraft {
  const schemeId = (form.schemeId ?? '').trim();
  if (!schemeId) return { ok: false, reason: 'scheme' };
  if (!form.consent) return { ok: false, reason: 'consent' };
  const required = form.requiredDocTypeIds ?? [];
  const uploaded = form.uploaded ?? {};
  if (!allDocsUploaded(required, uploaded)) return { ok: false, reason: 'documents' };
  const documents = required.map((docTypeId) => ({ docTypeId, mediaId: uploaded[docTypeId] }));
  return { ok: true, input: { schemeId, formData: { documents } } };
}

/** Read the attached document refs back off a (submitted) application's formData — defensive parse, never throws. */
export function readApplicationDocuments(formData: Record<string, unknown> | null | undefined): Array<{ docTypeId: string; mediaId: string }> {
  const docs = (formData as any)?.documents;
  if (!Array.isArray(docs)) return [];
  return docs.filter((d) => d && typeof d.docTypeId === 'string' && typeof d.mediaId === 'string').map((d) => ({ docTypeId: d.docTypeId, mediaId: d.mediaId }));
}
