// modules/land-soil-weather/gateway/reverse-geocode.provider.ts · binds REVERSE_GEOCODE by config (P1-4).
// A configured geocoder (weather.geocodeEnabled) → resilience-wrapped HTTP adapter; otherwise the noop adapter
// (returns null — the weather header shows a generic "your area", never a fabricated place name).
import { Provider } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { REVERSE_GEOCODE } from './reverse-geocode.port';
import { HttpReverseGeocodeProvider } from './http-reverse-geocode.provider';
import { NoopReverseGeocodeProvider } from './noop-reverse-geocode.provider';

export const reverseGeocodeProvider: Provider = {
  provide: REVERSE_GEOCODE,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const g = config.weather.geocode;
    if (g.enabled) return new HttpReverseGeocodeProvider({ baseUrl: g.baseUrl, apiKey: g.apiKey, providerCode: g.kind }, resilience);
    return new NoopReverseGeocodeProvider();
  },
};
