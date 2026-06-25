// modules/land-soil-weather/gateway/http-weather-forecast.provider.ts
// Real HTTP adapter to a geocoded forecast API (Open-Meteo by default — free, no key; an IMD/Skymet aggregator
// drops in by changing baseUrl + apiKey). Resilience-wrapped: timeout+retry+breaker+bulkhead. On exhaustion it
// throws WeatherProviderUnavailableError (degrade-never-hang, Law 12) — the SERVICE then falls back to a regional
// advisory. It NEVER returns invented numbers. No PII: lat/lng are coarse and not user identifiers.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { WeatherForecastProvider, ForecastQuery, NormalisedForecast } from './weather-forecast.port';
import { WeatherProviderUnavailableError } from '../domain/land-soil-weather.errors';
import { normaliseOpenMeteoDaily, gridRound } from '../domain/forecast';

const DEP = 'weather-forecast';

export interface HttpWeatherConfig { baseUrl: string; apiKey: string; providerCode: string }

export class HttpWeatherForecastProvider implements WeatherForecastProvider {
  readonly providerCode: string;
  private readonly log = new Logger('WeatherForecast');
  constructor(private readonly cfg: HttpWeatherConfig, private readonly resilience: ResilienceService) {
    this.providerCode = cfg.providerCode || 'open-meteo';
  }

  async fetch(q: ForecastQuery): Promise<NormalisedForecast> {
    const days = Math.max(1, Math.min(16, q.days ?? 7));
    const lat = gridRound(q.lat), lng = gridRound(q.lng);
    return this.resilience.run<NormalisedForecast>(DEP, async () => {
      const base = this.cfg.baseUrl.replace(/\/$/, '');
      const daily = 'temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code';
      const url = `${base}/v1/forecast?latitude=${lat}&longitude=${lng}&daily=${daily}&forecast_days=${days}&timezone=auto`;
      const headers: Record<string, string> = { accept: 'application/json' };
      if (this.cfg.apiKey) headers.authorization = `Bearer ${this.cfg.apiKey}`;   // aggregators that need a key
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`weather provider responded ${res.status}`);   // transient → retry → fallback throws
      const out = (await res.json().catch(() => ({}))) as { daily?: any };
      const fcDays = normaliseOpenMeteoDaily(out.daily ?? {});
      if (fcDays.length === 0) throw new Error('weather provider returned no days');
      return { lat, lng, providerCode: this.providerCode, fetchedAt: new Date().toISOString(), days: fcDays };
    }, {
      // GETs are safe to retry; on exhaustion surface a typed 503 — the service degrades to advisory, never fakes.
      fallback: () => { this.log.warn(`weather provider unavailable for ${lat},${lng}`); throw new WeatherProviderUnavailableError(); },
    });
  }
}
