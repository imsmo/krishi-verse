// Unit tests for the PURE profile/farm/bank/support logic (features/profile/profile). No React/native deps (SDK/ui
// types are type-only). Covers profile-patch + ticket + parcel form validation, email/VPA validators (ReDoS-safe),
// status/severity tones, the SLA read-out, and masked bank display. The server owns writes + the SLA clock + KYC.
import {
  isValidEmail, buildProfilePatch, ticketStatusTone, severityTone, canRateCsat, resolutionSlaState,
  buildTicketDraft, parcelAreaLabel, parcelStatusTone, buildParcelDraft, bankLabel, isValidVpa, TICKET_SEVERITIES,
  initials, landHoldingLabel, bankCodeFromIfsc, reportIssueSeverity, composeReportSubject,
} from '../../features/profile/profile';

describe('report-a-problem helpers', () => {
  it('maps issue type → default severity (fraud=P0, app=P3, unknown=P2)', () => {
    expect(reportIssueSeverity('fraud')).toBe('P0');
    expect(reportIssueSeverity('app')).toBe('P3');
    expect(reportIssueSeverity('payment')).toBe('P1');
    expect(reportIssueSeverity('zzz')).toBe('P2');
  });
  it('composes a subject from issue + order ref + description', () => {
    expect(composeReportSubject({ issueLabel: 'Payment not received', orderRef: 'KV-1', description: 'pending since Aug 13' }))
      .toBe('Payment not received [KV-1]: pending since Aug 13');
    expect(composeReportSubject({ issueLabel: 'App not working' })).toBe('App not working');
    expect(composeReportSubject({ description: 'just text' })).toBe('just text');
    expect(composeReportSubject({})).toBe('');
  });
});

describe('bankCodeFromIfsc', () => {
  it('takes the 4-letter bank code from a valid IFSC; null otherwise', () => {
    expect(bankCodeFromIfsc('SBIN0001247')).toBe('SBIN');
    expect(bankCodeFromIfsc('hdfc0000287')).toBe('HDFC');
    expect(bankCodeFromIfsc('BADIFSC')).toBeNull();
    expect(bankCodeFromIfsc(null)).toBeNull();
  });
});

describe('initials', () => {
  it('takes first + last word letters; degrades to ?', () => {
    expect(initials('Ramesh Patel')).toBe('RP');
    expect(initials('ramesh')).toBe('R');
    expect(initials('  ')).toBe('?');
    expect(initials(null)).toBe('?');
  });
});

describe('landHoldingLabel', () => {
  const p = (area: string, areaUnit: string, isTenantFarmed = false) => ({ area, areaUnit, isTenantFarmed });
  it('sums same-unit areas + reports ownership', () => {
    expect(landHoldingLabel([p('3', 'acre'), p('2', 'acre')])).toEqual({ area: '5', unit: 'acre', mixedUnits: false, ownership: 'owned' });
  });
  it('flags mixed units + mixed ownership', () => {
    const r = landHoldingLabel([p('3', 'acre', false), p('1', 'ha', true)]);
    expect(r!.mixedUnits).toBe(true);
    expect(r!.ownership).toBe('mixed');
    expect(r!.area).toBe('3');
  });
  it('null when no parcels', () => { expect(landHoldingLabel([])).toBeNull(); });
});

describe('isValidEmail / isValidVpa', () => {
  it('accepts valid and rejects invalid (bounded, no ReDoS)', () => {
    expect(isValidEmail('ram@example.com')).toBe(true);
    expect(isValidEmail('bad@@x')).toBe(false);
    expect(isValidEmail('no-at')).toBe(false);
    expect(isValidVpa('ram@okhdfc')).toBe(true);
    expect(isValidVpa('ram@@x')).toBe(false);
    expect(isValidVpa('nope')).toBe(false);
  });
});

describe('buildProfilePatch', () => {
  it('sends only changed fields, trimmed', () => {
    const d = buildProfilePatch({ fullName: '  Ram  ', languageCode: 'hi', email: ' ram@x.com ' });
    expect(d.ok).toBe(true);
    expect(d.patch).toEqual({ fullName: 'Ram', languageCode: 'hi', email: 'ram@x.com' });
  });
  it('rejects empty (nothing to change) and bad email', () => {
    expect(buildProfilePatch({}).reason).toBe('empty');
    expect(buildProfilePatch({ fullName: '   ' }).reason).toBe('empty');
    expect(buildProfilePatch({ email: 'bad' }).reason).toBe('email');
  });
});

describe('ticket tones + csat gate', () => {
  it('maps status/severity to tones', () => {
    expect(ticketStatusTone('resolved')).toBe('success');
    expect(ticketStatusTone('escalated')).toBe('danger');
    expect(ticketStatusTone('pending_customer')).toBe('warning');
    expect(ticketStatusTone('open')).toBe('info');
    expect(severityTone('P0')).toBe('danger');
    expect(severityTone('P2')).toBe('info');
  });
  it('csat only for resolved/closed', () => {
    expect(canRateCsat('resolved')).toBe(true);
    expect(canRateCsat('closed')).toBe(true);
    expect(canRateCsat('open')).toBe(false);
  });
});

describe('resolutionSlaState', () => {
  const now = Date.parse('2026-06-21T12:00:00Z');
  it('met when resolved before due; breached when resolved late or past due unresolved', () => {
    expect(resolutionSlaState({ slaResolutionDue: '2026-06-21T18:00:00Z', resolvedAt: '2026-06-21T10:00:00Z' }, now)).toBe('met');
    expect(resolutionSlaState({ slaResolutionDue: '2026-06-21T06:00:00Z', resolvedAt: '2026-06-21T10:00:00Z' }, now)).toBe('breached');
    expect(resolutionSlaState({ slaResolutionDue: '2026-06-21T06:00:00Z', resolvedAt: null }, now)).toBe('breached');
    expect(resolutionSlaState({ slaResolutionDue: '2026-06-21T18:00:00Z', resolvedAt: null }, now)).toBe('due');
    expect(resolutionSlaState({ slaResolutionDue: null, resolvedAt: null }, now)).toBe('none');
  });
});

describe('buildTicketDraft', () => {
  it('needs a subject or category; defaults severity to P2', () => {
    expect(buildTicketDraft({ subject: 'help me' }).input).toEqual({ subject: 'help me', categoryId: undefined, severity: 'P2' });
    expect(buildTicketDraft({ categoryId: 'c1', severity: 'P1' }).input).toEqual({ subject: undefined, categoryId: 'c1', severity: 'P1' });
    expect(buildTicketDraft({}).reason).toBe('empty');
    expect(buildTicketDraft({ subject: 'x', severity: 'P9' }).reason).toBe('severity');
  });
  it('exposes the canonical severity list', () => { expect(TICKET_SEVERITIES).toEqual(['P0', 'P1', 'P2', 'P3']); });
});

describe('parcel helpers', () => {
  it('labels area + status tone', () => {
    expect(parcelAreaLabel({ area: '2.5000', areaUnit: 'acre' })).toBe('2.5000 acre');
    expect(parcelStatusTone('verified')).toBe('success');
    expect(parcelStatusTone('rejected')).toBe('danger');
  });
  it('buildParcelDraft validates a positive decimal area (≤4 dp)', () => {
    expect(buildParcelDraft({ areaValue: '2.5', surveyNo: ' 12/3 ' }).input).toEqual({ areaValue: '2.5', areaUnit: 'acre', surveyNo: '12/3', regionId: undefined });
    expect(buildParcelDraft({ areaValue: '0' }).reason).toBe('area');
    expect(buildParcelDraft({ areaValue: 'abc' }).reason).toBe('area');
    expect(buildParcelDraft({ areaValue: '1.23456' }).reason).toBe('area');
  });
});

describe('bankLabel', () => {
  it('masks bank (last-4/IFSC) and shows the VPA for UPI', () => {
    expect(bankLabel({ accountKind: 'upi', upiId: 'ram@okhdfc', accountLast4: null, ifsc: null })).toBe('ram@okhdfc');
    expect(bankLabel({ accountKind: 'bank', upiId: null, accountLast4: '1234', ifsc: 'HDFC0001234' })).toBe('••••1234 · HDFC0001234');
    expect(bankLabel({ accountKind: 'bank', upiId: null, accountLast4: null, ifsc: null })).toBe('••••');
  });
});
