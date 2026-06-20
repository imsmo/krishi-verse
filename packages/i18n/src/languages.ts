// @krishi-verse/i18n · the supported-language registry (mirrors the DB `languages` table). Launch set is
// Hindi / English / Gujarati; adding Marathi/Bengali is one entry. `dir` drives RTL layout; `intlLocale` is the
// BCP-47 tag passed to Intl for number/date formatting.
export interface LanguageDef { code: string; nameNative: string; nameEnglish: string; intlLocale: string; dir: 'ltr' | 'rtl'; }

export const LANGUAGES: readonly LanguageDef[] = Object.freeze([
  { code: 'hi', nameNative: 'हिन्दी', nameEnglish: 'Hindi', intlLocale: 'hi-IN', dir: 'ltr' },
  { code: 'en', nameNative: 'English', nameEnglish: 'English', intlLocale: 'en-IN', dir: 'ltr' },
  { code: 'gu', nameNative: 'ગુજરાતી', nameEnglish: 'Gujarati', intlLocale: 'gu-IN', dir: 'ltr' },
]);
export const DEFAULT_LANGUAGE = 'en';
const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));
export function resolveLanguage(code: string | undefined | null): LanguageDef {
  if (code && BY_CODE.has(code)) return BY_CODE.get(code)!;
  // accept 'hi-IN' → 'hi'
  const short = code?.split('-')[0];
  return (short && BY_CODE.get(short)) || BY_CODE.get(DEFAULT_LANGUAGE)!;
}
export function isSupported(code: string): boolean { return BY_CODE.has(code) || BY_CODE.has(code.split('-')[0]); }
