// @krishi-verse/i18n · locale-aware formatters built on Intl. CRITICAL: money arrives as a STRING of bigint
// minor units (Law 2). We format it WITHOUT ever turning the whole amount into a JS number — the rupee part is
// grouped via Intl with a BigInt input (so ₹1,23,45,678.90 keeps full precision + correct lakh/crore grouping
// in Indian locales), the paise part is appended exactly. Negative + zero handled.
import { resolveLanguage } from './languages';

const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€' };

/** Format bigint minor units (as a string, e.g. "123456") into a localized currency string (e.g. "₹1,234.56"). */
export function formatMoneyMinor(minor: string | bigint, currencyCode = 'INR', langCode = 'en'): string {
  const lang = resolveLanguage(langCode);
  let v: bigint;
  try { v = typeof minor === 'bigint' ? minor : BigInt(minor); } catch { return `${CURRENCY_SYMBOL[currencyCode] ?? ''}0.00`; }
  const neg = v < 0n; const abs = neg ? -v : v;
  const rupees = abs / 100n; const paise = abs % 100n;
  const groupedRupees = new Intl.NumberFormat(lang.intlLocale, { useGrouping: true }).format(rupees);   // BigInt-safe grouping
  const sym = CURRENCY_SYMBOL[currencyCode] ?? `${currencyCode} `;
  return `${neg ? '-' : ''}${sym}${groupedRupees}.${paise.toString().padStart(2, '0')}`;
}

/** Plain number (counts, quantities — NOT money) localized. */
export function formatNumber(n: number, langCode = 'en'): string {
  return new Intl.NumberFormat(resolveLanguage(langCode).intlLocale).format(n);
}
export function formatDate(value: string | number | Date, langCode = 'en', opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(resolveLanguage(langCode).intlLocale, opts).format(new Date(value));
}
/** "3 days ago" / "in 2 hours" in the active language. */
export function formatRelative(value: string | number | Date, langCode = 'en', now: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(resolveLanguage(langCode).intlLocale, { numeric: 'auto' });
  const diffSec = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, secs] of units) if (Math.abs(diffSec) >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  return rtf.format(diffSec, 'second');
}
