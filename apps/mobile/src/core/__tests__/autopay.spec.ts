// Unit tests for the PURE autopay helpers (features/wallet/autopay, screen 181). No React/native deps.
import { autopayIcon, canCancelMandate, mandateStatusTone } from '../../features/wallet/autopay';

describe('autopayIcon', () => {
  it('maps known purposes, falls back to generic', () => {
    expect(autopayIcon('membership')).toBe('🛡️');
    expect(autopayIcon('loan_emi')).toBe('🏦');
    expect(autopayIcon('general')).toBe('🔁');
    expect(autopayIcon('anything_else')).toBe('🔁');
    expect(autopayIcon(null)).toBe('🔁');
  });
});

describe('canCancelMandate', () => {
  it('true only for live states', () => {
    expect(canCancelMandate('pending')).toBe(true);
    expect(canCancelMandate('active')).toBe(true);
    expect(canCancelMandate('paused')).toBe(true);
    expect(canCancelMandate('cancelled')).toBe(false);
    expect(canCancelMandate('expired')).toBe(false);
    expect(canCancelMandate(undefined)).toBe(false);
  });
});

describe('mandateStatusTone', () => {
  it('maps status → tone', () => {
    expect(mandateStatusTone('active')).toBe('success');
    expect(mandateStatusTone('paused')).toBe('warning');
    expect(mandateStatusTone('pending')).toBe('info');
    expect(mandateStatusTone('cancelled')).toBe('neutral');
    expect(mandateStatusTone('expired')).toBe('neutral');
  });
});
