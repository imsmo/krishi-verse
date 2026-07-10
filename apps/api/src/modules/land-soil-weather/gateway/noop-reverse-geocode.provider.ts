// modules/land-soil-weather/gateway/noop-reverse-geocode.provider.ts
// Degrade adapter, bound when NO reverse-geocoder is configured (local/dev, or provider kind 'none'). Always
// returns null — the weather header then shows a generic "your area" label. Never fabricates a place name.
import { ReverseGeocodeProvider } from './reverse-geocode.port';

export class NoopReverseGeocodeProvider implements ReverseGeocodeProvider {
  readonly providerCode = 'none';
  async reverse(_lat: number, _lng: number): Promise<string | null> { return null; }
}
