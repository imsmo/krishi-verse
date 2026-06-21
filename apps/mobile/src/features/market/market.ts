// apps/mobile/src/features/market/market.ts · PURE mandi-price + weather logic for P-19. No React/native (SDK/ui
// types are `import type` → erased) → unit-tested. Prices are bigint minor-unit strings (Law 2): the change-% is
// computed with BigInt (no precision loss on large paise values) and only the final percentage is a number for
// display. The SERVER is the authority on prices, predictions, alert firing (push), and advisories — these
// helpers only drive the UI.
import type { PillTone } from '@krishi-verse/ui-native';
import type { MandiPrice, WeatherAlert, PriceAlert } from '@krishi-verse/sdk-js';

/** Percent change between two bigint-minor prices, as a number rounded to 1 dp (display only). Uses BigInt so a
 * huge price never loses precision; returns null if old is missing/zero or inputs are malformed. */
export function priceChangePct(oldMinor: string | null | undefined, newMinor: string | null | undefined): number | null {
  if (!oldMinor || !newMinor) return null;
  let o: bigint, n: bigint;
  try { o = BigInt(oldMinor); n = BigInt(newMinor); } catch { return null; }
  if (o <= 0n) return null;
  // ((n-o) / o) * 1000 as an integer (1 extra digit for 1dp rounding), then /10.
  const scaled = ((n - o) * 1000n) / o;
  return Number(scaled) / 10;
}

/** Trend tone/arrow from a change-% (UX): up=success, down=danger, flat=neutral. */
export function changeTone(pct: number | null): PillTone {
  if (pct == null || pct === 0) return 'neutral';
  return pct > 0 ? 'success' : 'danger';
}
export function changeArrow(pct: number | null): '▲' | '▼' | '—' {
  if (pct == null || pct === 0) return '—';
  return pct > 0 ? '▲' : '▼';
}

/** Whole-rupees → paise minor string for an alert threshold (positive integer), or undefined to reject. */
export function rupeesToThresholdMinor(rupees: string): string | undefined {
  const clean = (rupees ?? '').trim();
  if (!/^\d{1,13}$/.test(clean) || clean === '0') return undefined;
  try { return (BigInt(clean) * 100n).toString(); } catch { return undefined; }
}

export interface AlertDraft { ok: boolean; input?: { productId: string; regionId?: string | null; direction: 'above' | 'below'; thresholdMinor: string }; reason?: 'product' | 'direction' | 'threshold' }
/** Validate + assemble a price-alert create payload from the form (the server re-validates, zod .strict). */
export function buildAlertDraft(form: { productId?: string; regionId?: string | null; direction?: string; rupees?: string }): AlertDraft {
  const productId = (form.productId ?? '').trim();
  if (!productId) return { ok: false, reason: 'product' };
  if (form.direction !== 'above' && form.direction !== 'below') return { ok: false, reason: 'direction' };
  const thresholdMinor = rupeesToThresholdMinor(form.rupees ?? '');
  if (!thresholdMinor) return { ok: false, reason: 'threshold' };
  return { ok: true, input: { productId, regionId: form.regionId ?? null, direction: form.direction, thresholdMinor } };
}

/** Price-alert status pill: active vs paused. */
export function alertTone(a: Pick<PriceAlert, 'isActive'>): PillTone { return a.isActive ? 'success' : 'neutral'; }

/** Weather severity → tone. */
export function weatherSeverityTone(severity: string): PillTone {
  switch (severity) {
    case 'severe': case 'extreme': case 'red': return 'danger';
    case 'moderate': case 'orange': return 'warning';
    case 'minor': case 'yellow': case 'advisory': return 'info';
    default: return 'neutral';
  }
}

/** Whether a weather advisory is currently in effect (UX; the server's activeOnly filter is authoritative).
 * `now` is injectable for testing. */
export function isAdvisoryActive(a: Pick<WeatherAlert, 'validFrom' | 'validTo'>, now: number = Date.now()): boolean {
  const from = a.validFrom ? Date.parse(a.validFrom) : NaN;
  const to = a.validTo ? Date.parse(a.validTo) : NaN;
  if (!Number.isNaN(from) && now < from) return false;
  if (!Number.isNaN(to) && now > to) return false;
  return true;
}

/** Latest-vs-previous change-% for a price history series (newest-first), for the pulse trend. */
export function historyTrendPct(history: Pick<MandiPrice, 'modalMinor'>[]): number | null {
  if (!history || history.length < 2) return null;
  return priceChangePct(history[1].modalMinor, history[0].modalMinor);
}
