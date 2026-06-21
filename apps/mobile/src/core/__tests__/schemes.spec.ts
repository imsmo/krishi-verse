// Unit tests for the PURE govt-schemes logic (features/schemes/schemes). No React/native deps (SDK/ui types are
// type-only). Covers status tone + allowed applicant actions, eligibility summary + input normalization, the
// document checklist completeness, and apply-draft assembly/validation. The server owns the real state machine,
// eligibility evaluation, and money (DBT) — these helpers only drive the UI.
import {
  applicationStatusTone, canSubmit, canResubmit, canAppeal, eligibilitySummary, buildEligibilityInput,
  docChecklist, allDocsUploaded, buildApplyDraft, readApplicationDocuments,
} from '../../features/schemes/schemes';

describe('applicationStatusTone', () => {
  it('maps statuses to tones', () => {
    expect(applicationStatusTone('approved')).toBe('success');
    expect(applicationStatusTone('disbursed')).toBe('success');
    expect(applicationStatusTone('rejected')).toBe('danger');
    expect(applicationStatusTone('clarification_needed')).toBe('warning');
    expect(applicationStatusTone('submitted')).toBe('info');
    expect(applicationStatusTone('draft')).toBe('neutral');
    expect(applicationStatusTone('???')).toBe('neutral');
  });
});

describe('allowed actions by status', () => {
  it('submit only from draft', () => {
    expect(canSubmit('draft')).toBe(true);
    expect(canSubmit('submitted')).toBe(false);
  });
  it('resubmit from clarification_needed or rejected; appeal only from rejected', () => {
    expect(canResubmit('clarification_needed')).toBe(true);
    expect(canResubmit('rejected')).toBe(true);
    expect(canResubmit('approved')).toBe(false);
    expect(canAppeal('rejected')).toBe(true);
    expect(canAppeal('clarification_needed')).toBe(false);
  });
});

describe('eligibilitySummary', () => {
  it('summarizes the server result', () => {
    expect(eligibilitySummary({ eligible: true, reasons: [] })).toEqual({ eligible: true, reasonCount: 0 });
    expect(eligibilitySummary({ eligible: false, reasons: ['a', 'b'] })).toEqual({ eligible: false, reasonCount: 2 });
    expect(eligibilitySummary(null)).toEqual({ eligible: false, reasonCount: 0 });
  });
});

describe('buildEligibilityInput', () => {
  it('normalizes + drops blanks/invalid (so empty fields are not sent as 0)', () => {
    expect(buildEligibilityInput({ landholdingAcres: '2.5', gender: 'female', age: '40' })).toEqual({ landholdingAcres: 2.5, gender: 'female', age: 40 });
    expect(buildEligibilityInput({ landholdingAcres: '', age: '' })).toEqual({});
    expect(buildEligibilityInput({ age: 'abc', landholdingAcres: '-1' })).toEqual({});
    expect(buildEligibilityInput({ gender: 'nope' as any })).toEqual({});
    expect(buildEligibilityInput({ roles: ['farmer'] })).toEqual({ roles: ['farmer'] });
  });
  it('rejects out-of-range age', () => {
    expect(buildEligibilityInput({ age: '200' })).toEqual({});
  });
});

describe('docChecklist / allDocsUploaded', () => {
  it('maps required doc types to uploaded state', () => {
    const list = docChecklist(['d1', 'd2'], { d1: 'm1' });
    expect(list).toEqual([{ docTypeId: 'd1', index: 0, mediaId: 'm1' }, { docTypeId: 'd2', index: 1, mediaId: null }]);
    expect(allDocsUploaded(['d1', 'd2'], { d1: 'm1' })).toBe(false);
    expect(allDocsUploaded(['d1', 'd2'], { d1: 'm1', d2: 'm2' })).toBe(true);
    expect(allDocsUploaded([], {})).toBe(true); // no docs required → ready
  });
});

describe('buildApplyDraft', () => {
  it('assembles formData.documents when scheme + consent + all docs present', () => {
    const d = buildApplyDraft({ schemeId: 's1', requiredDocTypeIds: ['d1'], uploaded: { d1: 'm1' }, consent: true });
    expect(d.ok).toBe(true);
    expect(d.input).toEqual({ schemeId: 's1', formData: { documents: [{ docTypeId: 'd1', mediaId: 'm1' }] } });
  });
  it('rejects with a typed reason', () => {
    expect(buildApplyDraft({ requiredDocTypeIds: [], uploaded: {}, consent: true }).reason).toBe('scheme');
    expect(buildApplyDraft({ schemeId: 's1', requiredDocTypeIds: [], uploaded: {}, consent: false }).reason).toBe('consent');
    expect(buildApplyDraft({ schemeId: 's1', requiredDocTypeIds: ['d1'], uploaded: {}, consent: true }).reason).toBe('documents');
  });
});

describe('readApplicationDocuments', () => {
  it('defensively parses formData.documents', () => {
    expect(readApplicationDocuments({ documents: [{ docTypeId: 'd1', mediaId: 'm1' }, { bad: true }] })).toEqual([{ docTypeId: 'd1', mediaId: 'm1' }]);
    expect(readApplicationDocuments(null)).toEqual([]);
    expect(readApplicationDocuments({ documents: 'nope' as any })).toEqual([]);
  });
});
