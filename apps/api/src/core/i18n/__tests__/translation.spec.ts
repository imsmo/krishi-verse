// core/i18n/__tests__/translation.spec.ts · vernacular fallback + interpolation.
import { TranslationService } from '../translation.service';
const t = new TranslationService();

describe('TranslationService', () => {
  it('returns the localized string for a known key', () => {
    expect(t.t('error.UNAUTHORIZED', 'hi')).toContain('साइन इन');
    expect(t.t('error.UNAUTHORIZED', 'gu')).toContain('સાઇન ઇન');
  });
  it('accepts region subtags (hi-IN → hi)', () => {
    expect(t.t('error.NOT_FOUND', 'hi-IN')).toBe(t.t('error.NOT_FOUND', 'hi'));
  });
  it('falls back to English, then to the key itself', () => {
    expect(t.t('error.NOT_FOUND', 'ta')).toBe(t.t('error.NOT_FOUND', 'en')); // no Tamil bundle yet → en
    expect(t.t('totally.unknown.key', 'hi')).toBe('totally.unknown.key');     // unknown → key
  });
  it('interpolates {params}', () => {
    // ad-hoc key proves interpolation independent of bundles
    expect((t as any).t.call(t, 'error.UNAUTHORIZED', 'en')).toBeTruthy();
    expect(t.t('{a}-{b}', 'en', { a: 1, b: 'x' })).toBe('1-x');
  });
});
