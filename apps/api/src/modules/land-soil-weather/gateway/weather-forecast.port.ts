// modules/land-soil-weather/gateway/weather-forecast.port.ts
// Port to the EXTERNAL geocoded weather-forecast provider (IMD / Open-Meteo / Skymet-style). Krishi-Verse owns
// the POLICY (which fields, caching, degrade-to-advisory); the provider owns the meteorology.
// CONTRACT (Law 12 — degrade, never die / never fabricate):
//   • fetch(lat,lng) returns a NORMALISED forecast (provider-agnostic shape) for the next N days.
//   • the adapter is resilience-wrapped (timeout+retry+breaker+bulkhead). On exhaustion it throws a typed
//     WeatherProviderUnavailableError — it NEVER returns invented numbers. The SERVICE decides the fallback
//     (regional advisory), so a forecast is either real or explicitly absent — never faked.
export const WEATHER_FORECAST = Symbol('WEATHER_FORECAST');

export interface ForecastQuery { lat: number; lng: number; days?: number }

/** One day of the normalised forecast. Temps °C, precip mm, prob 0-100, wind km/h — provider units normalised here. */
export interface ForecastDay {
  date: string;            // ISO yyyy-mm-dd (provider local day)
  tempMinC: number;
  tempMaxC: number;
  precipMm: number;
  precipProbPct: number;   // 0..100
  windKph: number;
  code: string;            // normalised condition: clear|clouds|rain|thunder|snow|fog|unknown
}

export interface NormalisedForecast {
  lat: number;
  lng: number;
  providerCode: string;    // 'open-meteo' | 'imd' | …  (never a fabricated value)
  fetchedAt: string;       // ISO timestamp the provider data was retrieved
  days: ForecastDay[];
}

export interface WeatherForecastProvider {
  readonly providerCode: string;
  fetch(q: ForecastQuery): Promise<NormalisedForecast>;
}
