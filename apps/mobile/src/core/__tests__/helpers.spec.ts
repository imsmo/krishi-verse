// Unit tests for the dependency-free helpers: phone normalization, resend cooldown, role routing, numerals.
import { normalizeIndianPhone, resendSecondsRemaining } from '../auth/otp.helpers';
import { isAppRole, homeRouteFor, defaultActiveRole, backendRoleCode, roleEligibility } from '../auth/role-switcher';
import { compactIndian, localizeDigits } from '../i18n/numerals';

describe('normalizeIndianPhone', () => {
  it('accepts a bare 10-digit mobile', () => expect(normalizeIndianPhone('9876543210')).toBe('+919876543210'));
  it('strips spaces/dashes and +91', () => expect(normalizeIndianPhone('+91 98765-43210')).toBe('+919876543210'));
  it('strips a leading 0', () => expect(normalizeIndianPhone('09876543210')).toBe('+919876543210'));
  it('rejects numbers not starting 6-9', () => expect(normalizeIndianPhone('1234567890')).toBeNull());
  it('rejects wrong length', () => expect(normalizeIndianPhone('98765')).toBeNull());
});

describe('resendSecondsRemaining', () => {
  it('counts down from the cooldown', () => expect(resendSecondsRemaining(0, 10_000, 30)).toBe(20));
  it('never goes negative', () => expect(resendSecondsRemaining(0, 60_000, 30)).toBe(0));
});

describe('role-switcher', () => {
  it('validates app roles', () => { expect(isAppRole('farmer')).toBe(true); expect(isAppRole('hacker')).toBe(false); });
  it('routes a known role, else farmer', () => {
    expect(homeRouteFor('buyer')).toBe('/(buyer)/home');
    expect(homeRouteFor('nonsense')).toBe('/(farmer)/home');
  });
  it('defaults active role to first known server role', () => {
    expect(defaultActiveRole(['random', 'trader'])).toBe('trader');
    expect(defaultActiveRole([])).toBe('farmer');
  });

  // KV-BL-066 (screens 04/433 role picker): the backend RBAC role codes diverge from the app's nav-facing
  // AppRole names for a few roles — onboarding.selectRole() must submit the code the API actually recognises.
  it('maps AppRole to the backend RBAC role code (KV-BL-066)', () => {
    expect(backendRoleCode('farmer')).toBe('farmer');
    expect(backendRoleCode('buyer')).toBe('customer');
    expect(backendRoleCode('trader')).toBe('vyapari');
    expect(backendRoleCode('owner')).toBe('tenant_admin');
    expect(backendRoleCode('ambassador')).toBe('ambassador');
    expect(backendRoleCode('worker')).toBe('worker');
  });

  it('mirrors the API self-serve pilot allow-list for role-card eligibility hints (client HINT only)', () => {
    expect(roleEligibility('farmer')).toBe('self_serve');
    expect(roleEligibility('buyer')).toBe('self_serve');
    expect(roleEligibility('owner')).toBe('invite_only');
    expect(roleEligibility('ambassador')).toBe('invite_only');
    expect(roleEligibility('trader')).toBe('not_pilot_ga');
    expect(roleEligibility('worker')).toBe('not_pilot_ga');
  });
});

describe('numerals', () => {
  it('compacts to Indian units', () => {
    expect(compactIndian(950)).toBe('950');
    expect(compactIndian(1200)).toBe('1.2K');
    expect(compactIndian(250000)).toBe('2.5L');
    expect(compactIndian(12000000)).toBe('1.2Cr');
  });
  it('transliterates digits for hi/gu and leaves en alone', () => {
    expect(localizeDigits('12', 'hi')).toBe('१२');
    expect(localizeDigits('12', 'gu')).toBe('૧૨');
    expect(localizeDigits('12', 'en')).toBe('12');
  });
});
