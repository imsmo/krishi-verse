// modules/land-soil-weather/domain/forecast.ts · PURE forecast helpers (no I/O): coordinate validation, a stable
// tenant-prefixed cache key (rounded so nearby farms share a cache entry — bounds provider cost/Law: cap & meter),
// Open-Meteo WMO weather-code → normalised condition, and a tiny derived agronomy hint. No fabrication: every
// number here is computed from provider input only.
import { ForecastDay, ForecastHour, NormalisedForecast } from '../gateway/weather-forecast.port';

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
const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
/** PURE: a real optional number from a provider array cell, or null (never a fabricated 0). */
function optNum(arr: number[] | undefined, i: number): number | null {
  const v = arr?.[i];
  return v == null || !Number.isFinite(Number(v)) ? null : round1(Number(v));
}
function optStr(arr: string[] | undefined, i: number): string | null {
  const v = arr?.[i];
  return v ? String(v) : null;
}

/** Map a raw Open-Meteo daily payload into our normalised ForecastDay[]. Defensive: skips malformed rows.
 *  Extended P1-4 metrics (apparent temp / UV / wind bearing / sunrise-set) attach only when present (null else). */
export function normaliseOpenMeteoDaily(daily: {
  time?: string[]; temperature_2m_min?: number[]; temperature_2m_max?: number[];
  precipitation_sum?: number[]; precipitation_probability_max?: number[]; wind_speed_10m_max?: number[]; weather_code?: number[];
  apparent_temperature_min?: number[]; apparent_temperature_max?: number[]; uv_index_max?: number[];
  wind_direction_10m_dominant?: number[]; sunrise?: string[]; sunset?: string[];
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
      precipProbPct: pct(Number(daily.precipitation_probability_max?.[i] ?? 0)),
      windKph: round1(Number(daily.wind_speed_10m_max?.[i] ?? 0)),
      code: wmoToCondition(Number(daily.weather_code?.[i] ?? -1)),
      feelsLikeMinC: optNum(daily.apparent_temperature_min, i),
      feelsLikeMaxC: optNum(daily.apparent_temperature_max, i),
      uvIndexMax: optNum(daily.uv_index_max, i),
      windDirDeg: optNum(daily.wind_direction_10m_dominant, i),
      sunrise: optStr(daily.sunrise, i),
      sunset: optStr(daily.sunset, i),
    });
  }
  return out;
}

/** Map a raw Open-Meteo hourly payload into ForecastHour[] (P1-4), keeping only entries at/after `fromMs` and
 *  capping to `max` (default 24) — bounded per Law 8. Defensive: skips malformed rows; missing metrics → null. */
export function normaliseOpenMeteoHourly(hourly: {
  time?: string[]; temperature_2m?: number[]; apparent_temperature?: number[]; relative_humidity_2m?: number[];
  precipitation_probability?: number[]; weather_code?: number[]; surface_pressure?: number[]; wind_speed_10m?: number[]; uv_index?: number[];
}, fromMs: number = Date.now(), max = 24): ForecastHour[] {
  const t = hourly.time ?? [];
  const out: ForecastHour[] = [];
  for (let i = 0; i < t.length && out.length < max; i++) {
    const time = t[i];
    if (!time) continue;
    const ts = Date.parse(time);
    if (Number.isFinite(ts) && ts + 3600_000 <= fromMs) continue;   // drop fully-elapsed hours (keep the current hour)
    out.push({
      time,
      tempC: round1(Number(hourly.temperature_2m?.[i] ?? 0)),
      feelsLikeC: optNum(hourly.apparent_temperature, i),
      humidityPct: hourly.relative_humidity_2m?.[i] == null ? null : pct(Number(hourly.relative_humidity_2m[i])),
      precipProbPct: pct(Number(hourly.precipitation_probability?.[i] ?? 0)),
      windKph: round1(Number(hourly.wind_speed_10m?.[i] ?? 0)),
      pressureHpa: optNum(hourly.surface_pressure, i),
      uvIndex: optNum(hourly.uv_index, i),
      code: wmoToCondition(Number(hourly.weather_code?.[i] ?? -1)),
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
