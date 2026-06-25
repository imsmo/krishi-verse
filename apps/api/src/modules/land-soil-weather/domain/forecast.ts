// modules/land-soil-weather/domain/forecast.ts · PURE forecast helpers (no I/O): coordinate validation, a stable
// tenant-prefixed cache key (rounded so nearby farms share a cache entry — bounds provider cost/Law: cap & meter),
// Open-Meteo WMO weather-code → normalised condition, and a tiny derived agronomy hint. No fabrication: every
// number here is computed from provider input only.
import { ForecastDay, NormalisedForecast } from '../gateway/weather-forecast.port';

export function isValidLat(lat: number): boolean { return Number.isFinite(lat) && lat >= -90 && lat <= 90; }
export function isValidLng(lng: number): boolean { return Number.isFinite(lng) && lng >= -180 && lng <= 180; }
export function areValidCoords(lat: number, lng: number): boolean { return isValidLat(lat) && isValidLng(lng); }

/** Round to ~1.1 km grid (3 dp) so adjacent requests hit one cache entry (cost/rate-limit control). */
export function gridRound(n: number): number { return Math.round(n * 1000) / 1000; }

/** Cache key for a forecast — tenant-prefixed by the CacheService; grid-rounded + day count. */
export function forecastCacheKey(lat: number, lng: number, days: number): string {
  return `weather:fc:${gridRound(lat)}:${gridRound(lng)}:d${days}`;
}

/** Open-Meteo / WMO weather code → our normalised condition bucket. Unknown codes → 'unknown' (never guessed). */
export function wmoToCondition(code: number): string {
  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return 'clouds';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  return 'unknown';
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Map a raw Open-Meteo daily payload into our normalised ForecastDay[]. Defensive: skips malformed rows. */
export function normaliseOpenMeteoDaily(daily: {
  time?: string[]; temperature_2m_min?: number[]; temperature_2m_max?: number[];
  precipitation_sum?: number[]; precipitation_probability_max?: number[]; wind_speed_10m_max?: number[]; weather_code?: number[];
}): ForecastDay[] {
  const t = daily.time ?? [];
  const out: ForecastDay[] = [];
  for (let i = 0; i < t.length; i++) {
    const date = t[i];
    if (!date) continue;
    out.push({
      date,
      tempMinC: round1(Number(daily.temperature_2m_min?.[i] ?? 0)),
      tempMaxC: round1(Number(daily.temperature_2m_max?.[i] ?? 0)),
      precipMm: round1(Number(daily.precipitation_sum?.[i] ?? 0)),
      precipProbPct: Math.max(0, Math.min(100, Math.round(Number(daily.precipitation_probability_max?.[i] ?? 0)))),
      windKph: round1(Number(daily.wind_speed_10m_max?.[i] ?? 0)),
      code: wmoToCondition(Number(daily.weather_code?.[i] ?? -1)),
    });
  }
  return out;
}

/** A single coarse agronomy signal derived from the forecast (NOT a fabricated advisory — pure thresholds on real
 *  numbers). Used to decide whether a push advisory is worth sending. Returns null when nothing notable. */
export function deriveForecastSignal(fc: NormalisedForecast): { kind: string; severity: 'info' | 'warning' | 'severe' } | null {
  const next3 = fc.days.slice(0, 3);
  if (next3.some((d) => d.code === 'thunder')) return { kind: 'thunderstorm', severity: 'severe' };
  if (next3.some((d) => d.precipMm >= 50 || (d.code === 'rain' && d.precipProbPct >= 80))) return { kind: 'heavy_rain', severity: 'warning' };
  if (next3.some((d) => d.tempMaxC >= 45)) return { kind: 'heatwave', severity: 'warning' };
  if (next3.some((d) => d.tempMinC <= 2)) return { kind: 'frost', severity: 'warning' };
  return null;
}
