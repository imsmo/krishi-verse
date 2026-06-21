// Unit tests for the PURE release logic (core/release) shipped in P-32: the forced-update decision (semver
// compare + min/recommended thresholds + remote override) and the OTA apply gate (flag + availability + never
// mid-critical-flow). The forced-update floor is a GA gate — a build below the min must be blocked, so the
// decision is exhaustively tested. No React/native deps.
import { compareVersions, decideUpdate, setUpdateThresholds, effectiveMin, effectiveRecommended } from '../../core/release/update-gate';
import { shouldApplyOta } from '../../core/release/ota';

describe('compareVersions', () => {
  it('compares dotted versions numerically', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
  });
});

describe('decideUpdate — forced-update floor', () => {
  it('forced when current < min', () => {
    expect(decideUpdate('1.0.0', '1.2.0')).toBe('forced');
  });
  it('recommended when current < recommended but >= min', () => {
    expect(decideUpdate('1.2.0', '1.0.0', '1.5.0')).toBe('recommended');
  });
  it('none when at/above both, or when thresholds are missing (fail-open)', () => {
    expect(decideUpdate('1.5.0', '1.0.0', '1.5.0')).toBe('none');
    expect(decideUpdate('1.0.0', null, null)).toBe('none');
    expect(decideUpdate('1.0.0', undefined)).toBe('none');
  });
  it('forced takes precedence over recommended', () => {
    expect(decideUpdate('1.0.0', '1.2.0', '1.5.0')).toBe('forced');
  });
});

describe('remote thresholds override static config', () => {
  afterEach(() => setUpdateThresholds(null, null));
  it('effectiveMin/Recommended prefer the remote value, else static fallback', () => {
    expect(effectiveMin('1.0.0')).toBe('1.0.0');
    expect(effectiveRecommended('1.1.0')).toBe('1.1.0');
    setUpdateThresholds('2.0.0', '2.1.0');
    expect(effectiveMin('1.0.0')).toBe('2.0.0');
    expect(effectiveRecommended('1.1.0')).toBe('2.1.0');
    expect(decideUpdate('1.5.0', effectiveMin('1.0.0'))).toBe('forced'); // remote floor now applies
  });
  it('clears the override back to static', () => {
    setUpdateThresholds('2.0.0');
    setUpdateThresholds(null, null);
    expect(effectiveMin('1.0.0')).toBe('1.0.0');
  });
});

describe('shouldApplyOta — flag + availability + not mid-critical-flow', () => {
  it('applies only when enabled, available, and not in a critical flow', () => {
    expect(shouldApplyOta({ enabled: true, available: true, isCriticalFlow: false })).toBe(true);
    expect(shouldApplyOta({ enabled: false, available: true, isCriticalFlow: false })).toBe(false);
    expect(shouldApplyOta({ enabled: true, available: false, isCriticalFlow: false })).toBe(false);
    expect(shouldApplyOta({ enabled: true, available: true, isCriticalFlow: true })).toBe(false); // never reload mid-checkout/pay/OTP
  });
});
