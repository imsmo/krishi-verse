// Pure unit tests for forecast helpers + the ForecastService cache/degrade behaviour (no real provider/DB).
import {
  isValidLat, isValidLng, areValidCoords, gridRound, forecastCacheKey, wmoToCondition,
  normaliseOpenMeteoDaily, deriveForecastSignal,
} from '../domain/forecast';
import { ForecastService } from '../services/forecast.service';
import { NormalisedForecast } from '../gateway/weather-forecast.port';
import { InvalidCoordinatesError, WeatherProviderUnavailableError } from '../domain/land-soil-weather.errors';

describe('forecast pure helpers', () => {
  it('validates coordinates', () => {
    expect(areValidCoords(19.07, 72.87)).toBe(true);
    expect(isValidLat(91)).toBe(false);
    expect(isValidLng(181)).toBe(false);
    expect(areValidCoords(NaN, 0)).toBe(false);
  });
  it('grid-rounds to 3dp and builds a stable cache key', () => {
    expect(gridRound(19.0760123)).toBe(19.076);
    expect(forecastCacheKey(19.0760123, 72.8771, 7)).toBe('weather:fc:19.076:72.877:d7');
  });
  it('maps WMO codes to normalised conditions', () => {
    expect(wmoToCondition(0)).toBe('clear');
    expect(wmoToCondition(2)).toBe('clouds');
    expect(wmoToCondition(61)).toBe('rain');
    expect(wmoToCondition(95)).toBe('thunder');
    expect(wmoToCondition(73)).toBe('snow');
    expect(wmoToCondition(999)).toBe('unknown');
  });
  it('normalises an Open-Meteo daily payload (and clamps prob, skips empty rows)', () => {
    const days = normaliseOpenMeteoDaily({
      time: ['2026-06-25', '2026-06-26'],
      temperature_2m_min: [26.44, 27], temperature_2m_max: [33.2, 34],
      precipitation_sum: [12.34, 0], precipitation_probability_max: [120, 10],
      wind_speed_10m_max: [18.9, 9], weather_code: [61, 0],
    });
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ date: '2026-06-25', tempMinC: 26.4, tempMaxC: 33.2, precipMm: 12.3, precipProbPct: 100, code: 'rain' });
    expect(days[1].code).toBe('clear');
  });
  it('derives an agronomy signal only when notable', () => {
    const base = (over: Partial<{ code: string; precipMm: number; precipProbPct: number; tempMaxC: number; tempMinC: number }>) =>
      ({ date: 'd', tempMinC: 20, tempMaxC: 30, precipMm: 0, precipProbPct: 0, windKph: 5, code: 'clear', ...over });
    const fc = (days: any[]): NormalisedForecast => ({ lat: 0, lng: 0, providerCode: 'x', fetchedAt: 'now', days });
    expect(deriveForecastSignal(fc([base({ code: 'thunder' })]))!.kind).toBe('thunderstorm');
    expect(deriveForecastSignal(fc([base({ precipMm: 60 })]))!.kind).toBe('heavy_rain');
    expect(deriveForecastSignal(fc([base({ tempMaxC: 46 })]))!.kind).toBe('heatwave');
    expect(deriveForecastSignal(fc([base({ tempMinC: 1 })]))!.kind).toBe('frost');
    expect(deriveForecastSignal(fc([base({})]))).toBeNull();
  });
});

describe('ForecastService', () => {
  const sample: NormalisedForecast = { lat: 19.076, lng: 72.877, providerCode: 'open-meteo', fetchedAt: 'now', days: [{ date: '2026-06-25', tempMinC: 26, tempMaxC: 33, precipMm: 1, precipProbPct: 20, windKph: 10, code: 'clouds' }] };
  const config = { weather: { forecastDays: 7, cacheTtlSec: 3600 } } as any;

  function build(opts: { providerFetch?: jest.Mock; cacheGet?: jest.Mock } = {}) {
    const cacheStore: Record<string, unknown> = {};
    const cache = {
      get: opts.cacheGet ?? jest.fn(async (k: string) => cacheStore[k] ?? null),
      set: jest.fn(async (k: string, v: unknown) => { cacheStore[k] = v; }),
    } as any;
    const provider = { providerCode: 'open-meteo', fetch: opts.providerFetch ?? jest.fn(async () => sample) } as any;
    const advisories = { listForRegion: jest.fn(async () => [{ id: 'a1', severity: 'warning' }]) } as any;
    const svc = new ForecastService(provider, cache, config, advisories);
    return { svc, cache, provider, advisories };
  }

  it('rejects invalid coordinates before calling the provider', async () => {
    const { svc, provider } = build();
    await expect(svc.forecast('t1', { lat: 999, lng: 0 })).rejects.toBeInstanceOf(InvalidCoordinatesError);
    expect(provider.fetch).not.toHaveBeenCalled();
  });

  it('fetches + caches on a miss, then serves from cache on the next call', async () => {
    const { svc, provider, cache } = build();
    const r1 = await svc.forecast('t1', { lat: 19.076, lng: 72.877 });
    expect(r1.source).toBe('forecast'); expect(r1.forecast).toEqual(sample);
    expect(cache.set).toHaveBeenCalledTimes(1);
    const r2 = await svc.forecast('t1', { lat: 19.076, lng: 72.877 });
    expect(r2.source).toBe('forecast');
    expect(provider.fetch).toHaveBeenCalledTimes(1); // second call hit cache
  });

  it('DEGRADES to regional advisories (never fabricates) when the provider is down + regionId given', async () => {
    const fetch = jest.fn(async () => { throw new WeatherProviderUnavailableError(); });
    const { svc, advisories } = build({ providerFetch: fetch });
    const r = await svc.forecast('t1', { lat: 19.076, lng: 72.877, regionId: '11111111-1111-1111-1111-111111111111' });
    expect(r.degraded).toBe(true);
    expect(r.source).toBe('advisory');
    expect(r.forecast).toBeNull();
    expect(r.advisories).toHaveLength(1);
    expect(advisories.listForRegion).toHaveBeenCalled();
  });

  it('surfaces 503 (no fabrication) when the provider is down and no region fallback exists', async () => {
    const fetch = jest.fn(async () => { throw new WeatherProviderUnavailableError(); });
    const { svc } = build({ providerFetch: fetch });
    await expect(svc.forecast('t1', { lat: 19.076, lng: 72.877 })).rejects.toBeInstanceOf(WeatherProviderUnavailableError);
  });
});
