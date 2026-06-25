// modules/land-soil-weather/services/forecast.service.ts · geocoded forecast read-through with advisory fallback.
//
// CONTRACT (Law 12 + "never fabricate"):
//   • Validate lat/lng before any provider call (anti-abuse / no junk to the provider).
//   • Cache-aside on a grid-rounded, GLOBAL key (weather at a coordinate is the SAME for every tenant — it is
//     reference data, not tenant data; sharing the entry caps provider cost/rate-limits, which is our problem).
//   • On a live cache miss, call the resilience-wrapped provider. On provider exhaustion (typed 503) DEGRADE:
//     if the caller gave a regionId, return that region's real advisories with degraded:true — NEVER invent a
//     forecast. With no region context there is nothing real to return, so the 503 surfaces.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_SERVICE, CacheService } from '../../../core/cache/cache.service';
import { AppConfig } from '../../../core/config/app-config';
import { WEATHER_FORECAST, WeatherForecastProvider, NormalisedForecast } from '../gateway/weather-forecast.port';
import { WeatherAlertService } from './weather-alert.service';
import { areValidCoords, forecastCacheKey } from '../domain/forecast';
import { InvalidCoordinatesError, WeatherProviderUnavailableError } from '../domain/land-soil-weather.errors';

export interface ForecastResult {
  degraded: boolean;                 // true ⇒ provider was down; forecast is null and advisories carry the fallback
  source: 'forecast' | 'advisory';
  providerCode: string | null;
  forecast: NormalisedForecast | null;
  advisories: unknown[];             // populated only when degraded (regional advisories for regionId)
}

@Injectable()
export class ForecastService {
  private readonly log = new Logger('ForecastService');
  constructor(
    @Inject(WEATHER_FORECAST) private readonly provider: WeatherForecastProvider,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly advisories: WeatherAlertService,
  ) {}

  async forecast(tenantId: string, q: { lat: number; lng: number; days?: number; regionId?: string }): Promise<ForecastResult> {
    if (!areValidCoords(q.lat, q.lng)) throw new InvalidCoordinatesError();
    const cfg = this.config.weather;
    const days = Math.max(1, Math.min(16, q.days ?? cfg.forecastDays));
    const key = forecastCacheKey(q.lat, q.lng, days);   // global reference-data key (shared across tenants)

    const cached = await this.cache.get<NormalisedForecast>(key);
    if (cached) return { degraded: false, source: 'forecast', providerCode: cached.providerCode, forecast: cached, advisories: [] };

    try {
      const fc = await this.provider.fetch({ lat: q.lat, lng: q.lng, days });
      await this.cache.set(key, fc, cfg.cacheTtlSec);   // cache only successes (never an error)
      return { degraded: false, source: 'forecast', providerCode: fc.providerCode, forecast: fc, advisories: [] };
    } catch (e) {
      if (e instanceof WeatherProviderUnavailableError) {
        // DEGRADE — never fabricate. Fall back to the region's real ingested advisories if we have a region.
        if (q.regionId) {
          const advisories = await this.advisories.listForRegion(tenantId, q.regionId, true, 20);
          this.log.warn(`forecast degraded to advisory for region ${q.regionId} (provider down)`);
          return { degraded: true, source: 'advisory', providerCode: null, forecast: null, advisories };
        }
        throw e;   // no advisory context → surface 503 rather than invent a forecast
      }
      throw e;
    }
  }
}
