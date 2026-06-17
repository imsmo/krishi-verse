// core/i18n/language.middleware.ts
// Language resolution is performed in the tenant-context middleware (it sets ctx.lang
// from the JWT/Accept-Language/X-Lang header). This file documents that contract and
// exposes a helper for non-request contexts (jobs/handlers) that default to English.
export const DEFAULT_LANG = 'en';
export function baseLang(lang?: string): string { return (lang || DEFAULT_LANG).toLowerCase().split('-')[0]; }
