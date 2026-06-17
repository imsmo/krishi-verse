// core/i18n/translation.service.ts
// Server-side i18n (Law 7: user-facing text via keys, never literals). Vernacular-first:
// resolves a key in the caller's language, falling back to English, then to the key itself
// (so a missing translation degrades gracefully, never crashes). {param} interpolation.
// Launch languages: en, hi, gu (Phase-1 production set); add a bundle to extend.
import { Injectable } from '@nestjs/common';
import en from './locales/en';
import hi from './locales/hi';
import gu from './locales/gu';

const BUNDLES: Record<string, Record<string, string>> = { en, hi, gu };

@Injectable()
export class TranslationService {
  /** lang may be 'hi', 'hi-IN', etc. — we take the base subtag. */
  t(key: string, lang = 'en', params?: Record<string, string | number>): string {
    const base = (lang || 'en').toLowerCase().split('-')[0];
    const msg = BUNDLES[base]?.[key] ?? BUNDLES.en[key] ?? key;
    if (!params) return msg;
    return msg.replace(/\{(\w+)\}/g, (_m, p) => (params[p] !== undefined ? String(params[p]) : `{${p}}`));
  }
  has(key: string): boolean { return key in BUNDLES.en; }
}
export const I18N_SERVICE = Symbol('I18N_SERVICE');
