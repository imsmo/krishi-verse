// modules/land-soil-weather/gateway/weather-forecast.provider.ts · binds WEATHER_FORECAST by config.
// A configured provider (WEATHER_PROVIDER_URL set, default Open-Meteo public endpoint) → resilience-wrapped HTTP
// adapter; otherwise the noop/degrade adapter (always falls back to regional advisory — never fabricates).
import { Provider } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { WEATHER_FORECAST } from './weather-forecast.port';
import { HttpWeatherForecastProvider } from './http-weather-forecast.provider';
import { NoopWeatherForecastProvider } from './noop-weather-forecast.provider';

export const weatherForecastProvider: Provider = {
  provide: WEATHER_FORECAST,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const w = config.weather;
    if (w.enabled) return new HttpWeatherForecastProvider({ baseUrl: w.baseUrl, apiKey: w.apiKey, providerCode: w.kind }, resilience);
    return new NoopWeatherForecastProvider();
  },
};
