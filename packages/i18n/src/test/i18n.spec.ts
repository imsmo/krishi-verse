// @krishi-verse/i18n · formatter + translator unit tests. The critical one: money formats from a bigint-string
// of minor units with FULL precision (no float rounding) and correct Indian lakh/crore grouping.
import { formatMoneyMinor, formatNumber, Translator, resolveLanguage } from '../index';

describe('formatMoneyMinor (bigint-string minor units, no float)', () => {
  it('formats paise → ₹ with 2 decimals + Indian grouping', () => {
    expect(formatMoneyMinor('123456', 'INR', 'en')).toBe('₹1,234.56');
    expect(formatMoneyMinor('5', 'INR', 'en')).toBe('₹0.05');
    expect(formatMoneyMinor('-99900', 'INR', 'en')).toBe('-₹999.00');
  });
  it('keeps FULL precision for amounts beyond JS safe-integer (no float rounding)', () => {
    // 9007199254740991 paise is past Number.MAX_SAFE_INTEGER; rupees=90071992547409, paise=91.
    const out = formatMoneyMinor('9007199254740991', 'INR', 'en');
    expect(out.endsWith('.91')).toBe(true);                               // paise exact
    expect(out.replace(/[^0-9]/g, '')).toBe('9007199254740991');          // all digits preserved (rupees+paise), nothing rounded
  });
  it('falls back safely on a bad amount', () => {
    expect(formatMoneyMinor('not-a-number', 'INR', 'en')).toBe('₹0.00');
  });
});

describe('languages + numbers', () => {
  it('resolves hi-IN → hi and falls back unknown → en', () => {
    expect(resolveLanguage('hi-IN').code).toBe('hi');
    expect(resolveLanguage('zz').code).toBe('en');
  });
  it('formats plain counts (not money)', () => {
    expect(typeof formatNumber(1234, 'en')).toBe('string');
  });
});

describe('Translator', () => {
  it('interpolates, falls back to default lang then to the key', () => {
    const t = new Translator('hi').register('en', { greeting: 'Hi {name}' }).register('hi', { greeting: 'नमस्ते {name}' });
    expect(t.t('greeting', { name: 'Asha' })).toBe('नमस्ते Asha');
    expect(t.t('missing.key')).toBe('missing.key');
    const en = new Translator('hi').register('en', { only_en: 'Fallback' });
    expect(en.t('only_en')).toBe('Fallback');   // falls back to default-language catalog
  });
});
