// Unit tests for the PURE profile/farm/bank/support logic (features/profile/profile). No React/native deps (SDK/ui
// types are type-only). Covers profile-patch + ticket + parcel form validation, email/VPA validators (ReDoS-safe),
// status/severity tones, the SLA read-out, and masked bank display. The server owns writes + the SLA clock + KYC.
import {
  isValidEmail, buildProfilePatch, ticketStatusTone, severityTone, canRateCsat, resolutionSlaState,
  buildTicketDraft, parcelAreaLabel, parcelStatusTone, buildParcelDraft, bankLabel, isValidVpa, TICKET_SEVERITIES,
} from '../../features/profile/profile';

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
