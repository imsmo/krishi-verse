// modules/land-soil-weather/gateway/noop-weather-forecast.provider.ts
// Degrade adapter, bound when NO forecast provider is configured. It NEVER fabricates a forecast — it always
// throws WeatherProviderUnavailableError, which makes the service fall back to the real regional advisory. This
// keeps the contract "forecast is never faked" true even in local/dev where no provider URL is set.
import { WeatherForecastProvider, ForecastQuery, NormalisedForecast } from './weather-forecast.port';
import { WeatherProviderUnavailableError } from '../domain/land-soil-weather.errors';

export class NoopWeatherForecastProvider implements WeatherForecastProvider {
  readonly providerCode = 'none';
  async fetch(_q: ForecastQuery): Promise<NormalisedForecast> { throw new WeatherProviderUnavailableError(); }
}
