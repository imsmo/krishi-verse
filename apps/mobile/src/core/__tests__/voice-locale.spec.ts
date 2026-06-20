// Unit tests for the pure STT locale mapping (core/voice/locale). No React, no native deps.
import { sttLocaleFor } from '../voice/locale';

describe('sttLocaleFor', () => {
  it('maps the three supported UI languages to Indian STT locales', () => {
    expect(sttLocaleFor('hi')).toBe('hi-IN');
    expect(sttLocaleFor('gu')).toBe('gu-IN');
    expect(sttLocaleFor('en')).toBe('en-IN');
  });

  it('matches on the 2-letter prefix (region/script suffixes ignored)', () => {
    expect(sttLocaleFor('hi-IN')).toBe('hi-IN');
    expect(sttLocaleFor('gu_IN')).toBe('gu-IN');
    expect(sttLocaleFor('en-US')).toBe('en-IN'); // we always dictate in Indian English
  });

  it('defaults to en-IN for unknown/empty/garbage input (degrade-never-die)', () => {
    expect(sttLocaleFor('')).toBe('en-IN');
    expect(sttLocaleFor('fr')).toBe('en-IN');
    expect(sttLocaleFor(undefined as unknown as string)).toBe('en-IN');
  });
});
