// modules/land-soil-weather/gateway/http-reverse-geocode.provider.ts
// Real HTTP reverse-geocoder (BigDataCloud client endpoint by default — free, no key; any provider drops in by
// changing baseUrl). Resilience-wrapped: timeout+retry+breaker+bulkhead. On ANY error it returns null (best-effort
// header label — never blocks the forecast, never fabricates a name). No PII: lat/lng are grid-rounded upstream.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { ReverseGeocodeProvider } from './reverse-geocode.port';
import { gridRound } from '../domain/forecast';

const DEP = 'reverse-geocode';

export interface HttpGeocodeConfig { baseUrl: string; apiKey: string; providerCode: string }

export class HttpReverseGeocodeProvider implements ReverseGeocodeProvider {
  readonly providerCode: string;
  private readonly log = new Logger('ReverseGeocode');
  constructor(private readonly cfg: HttpGeocodeConfig, private readonly resilience: ResilienceService) {
    this.providerCode = cfg.providerCode || 'bigdatacloud';
  }

  async reverse(lat: number, lng: number): Promise<string | null> {
    const glat = gridRound(lat), glng = gridRound(lng);
    return this.resilience.run<string | null>(DEP, async () => {
      const base = this.cfg.baseUrl.replace(/\/$/, '');
      const key = this.cfg.apiKey ? `&key=${encodeURIComponent(this.cfg.apiKey)}` : '';
      const url = `${base}/data/reverse-geocode-client?latitude=${glat}&longitude=${glng}&localityLanguage=en${key}`;
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`reverse-geocode responded ${res.status}`);
      const j = (await res.json().catch(() => ({}))) as { city?: string; locality?: string; principalSubdivision?: string };
      // Prefer the most specific real label the provider returned; never invent one.
      const label = (j.city || j.locality || j.principalSubdivision || '').trim();
      return label || null;
    }, {
      // Best-effort only — on exhaustion return null so the forecast header falls back to a generic label.
      fallback: () => { this.log.warn(`reverse-geocode unavailable for ${glat},${glng}`); return null; },
    });
  }
}
