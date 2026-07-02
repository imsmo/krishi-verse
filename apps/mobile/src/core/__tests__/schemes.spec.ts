// Unit tests for the PURE govt-schemes logic (features/schemes/schemes). No React/native deps (SDK/ui types are
// type-only). Covers status tone + allowed applicant actions, eligibility summary + input normalization, the
// document checklist completeness, and apply-draft assembly/validation. The server owns the real state machine,
// eligibility evaluation, and money (DBT) — these helpers only drive the UI.
import {
  applicationStatusTone, canSubmit, canResubmit, canAppeal, eligibilitySummary, buildEligibilityInput,
  docChecklist, allDocsUploaded, buildApplyDraft, readApplicationDocuments, applicationsBySchemeId,
  isValidAadhaar, isValidPincode, isValidMobile10, buildSchemeDetailsDraft, applicationTimeline,
  schemeAppTab, matchesSchemeAppTab, schemeAppCounts, schemeAppStage,
} from '../../features/schemes/schemes';

describe('scheme application tabs + counts', () => {
  it('groups statuses into active/received/rejected', () => {
    expect(schemeAppTab('under_verification')).toBe('active');
    expect(schemeAppTab('disbursed')).toBe('received');
    expect(schemeAppTab('approved')).toBe('received');
    expect(schemeAppTab('rejected')).toBe('rejected');
  });
  it('matches the All tab for everything', () => {
    expect(matchesSchemeAppTab('rejected', 'all')).toBe(true);
    expect(matchesSchemeAppTab('rejected', 'active')).toBe(false);
  });
  it('counts by tab', () => {
    const c = schemeAppCounts([{ status: 'under_verification' }, { status: 'approved' }, { status: 'rejected' }, { status: 'submitted' }]);
    expect(c).toEqual({ all: 4, active: 2, received: 1, rejected: 1 });
  });
});

describe('schemeAppStage', () => {
  it('points at the active step for in-flight apps', () => {
    const s = schemeAppStage('under_verification');
    expect(s.total).toBe(5);
    expect(s.stage).toBe(2); // verification is step 2
    expect(s.stepKey).toBe('verification');
  });
  it('lands on the last step when disbursed', () => {
    expect(schemeAppStage('disbursed').stepKey).toBe('payment');
  });
});

describe('applicationTimeline', () => {
  const states = (s: string) => applicationTimeline(s).map((x) => x.state);
  it('submitted → first done, verification active, rest pending', () => {
    expect(states('submitted')).toEqual(['done', 'active', 'pending', 'pending', 'pending']);
  });
  it('approved → up to state-approval done, payment active', () => {
    expect(states('approved')).toEqual(['done', 'done', 'done', 'done', 'active']);
  });
  it('disbursed → all done (no active)', () => {
    expect(states('disbursed')).toEqual(['done', 'done', 'done', 'done', 'done']);
  });
  it('rejected → no active step', () => {
    expect(states('rejected')).not.toContain('active');
  });
});

describe('scheme field validators', () => {
  it('Aadhaar = 12 digits (ignores spaces)', () => {
    expect(isValidAadhaar('1234 5678 9012')).toBe(true);
    expect(isValidAadhaar('12345')).toBe(false);
  });
  it('PIN = 6 digits not starting 0', () => {
    expect(isValidPincode('388001')).toBe(true);
    expect(isValidPincode('012345')).toBe(false);
    expect(isValidPincode('38800')).toBe(false);
  });
  it('mobile = 10 digits 6-9, tolerates +91/0', () => {
    expect(isValidMobile10('+91 99000 00101')).toBe(true);
    expect(isValidMobile10('09900000101')).toBe(true);
    expect(isValidMobile10('12345')).toBe(false);
    expect(isValidMobile10('5900000000')).toBe(false);
  });
});

describe('buildSchemeDetailsDraft', () => {
  const full = {
    fullName: 'Ramesh Patel', aadhaar: '1234 5678 9012', mobile: '9900000101', fatherName: 'X',
    dob: '1980-01-01', category: 'general', gender: 'male', village: 'Anand', taluka: 'Anand',
    district: 'Anand', state: 'Gujarat', pincode: '388001',
  };
  it('assembles personalDetails when complete (Aadhaar normalized to digits)', () => {
    const d = buildSchemeDetailsDraft(full);
    expect(d.ok).toBe(true);
    expect((d.details as any).personalDetails.aadhaar).toBe('123456789012');
    expect((d.details as any).personalDetails.address.pincode).toBe('388001');
  });
  it('reports each missing/invalid field', () => {
    const d = buildSchemeDetailsDraft({ ...full, aadhaar: '12', pincode: '0', gender: '' });
    expect(d.ok).toBe(false);
    expect(d.missing).toContain('aadhaar');
    expect(d.missing).toContain('pincode');
    expect(d.missing).toContain('gender');
    expect(d.missing).not.toContain('fullName');
  });
});

describe('buildApplyDraft merges details into formData', () => {
  it('carries personal/land details alongside documents', () => {
    const d = buildApplyDraft({ schemeId: 's1', requiredDocTypeIds: ['d1'], uploaded: { d1: 'm1' }, consent: true, details: { personalDetails: { fullName: 'R' } } });
    expect(d.ok).toBe(true);
    expect((d.input!.formData as any).personalDetails.fullName).toBe('R');
    expect((d.input!.formData as any).documents).toEqual([{ docTypeId: 'd1', mediaId: 'm1' }]);
  });
});

describe('applicationsBySchemeId', () => {
  it('maps schemeId → latest application status (by createdAt)', () => {
    const m = applicationsBySchemeId([
      { schemeId: 's1', status: 'draft', createdAt: '2026-01-01T00:00:00Z' },
      { schemeId: 's1', status: 'submitted', createdAt: '2026-02-01T00:00:00Z' },
      { schemeId: 's2', status: 'approved' },
    ]);
    expect(m.s1).toBe('submitted'); // newer wins
    expect(m.s2).toBe('approved');
    expect(m.s3).toBeUndefined();
  });
  it('is empty for no apps', () => { expect(applicationsBySchemeId([])).toEqual({}); });
});

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
