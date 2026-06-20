// @krishi-verse/sdk-js · the client facade. Compose once per request context (SSR: a fresh client with the
// request's token; browser: one client reading the in-memory token). Resource clients hang off it.
import { SdkConfig, resolveConfig } from './config';
import { HttpClient, HttpMethod, RequestOptions, Envelope } from './http';
import { ListingsResource } from './resources/listings';
import { CatalogueResource } from './resources/catalogue';
import { TraceabilityResource } from './resources/traceability';
import { AuthResource } from './resources/auth';

export class KrishiVerseClient {
  private readonly http: HttpClient;
  readonly listings: ListingsResource;
  readonly catalogue: CatalogueResource;
  readonly traceability: TraceabilityResource;
  readonly auth: AuthResource;

  constructor(config: SdkConfig) {
    this.http = new HttpClient(resolveConfig(config));
    this.listings = new ListingsResource(this.http);
    this.catalogue = new CatalogueResource(this.http);
    this.traceability = new TraceabilityResource(this.http);
    this.auth = new AuthResource(this.http);
  }
  /** Escape hatch for endpoints without a dedicated resource method yet. Same envelope + resilience. */
  request<T>(method: HttpMethod, path: string, opts?: RequestOptions): Promise<Envelope<T>> {
    return this.http.request<T>(method, path, opts);
  }
}
export function createClient(config: SdkConfig): KrishiVerseClient { return new KrishiVerseClient(config); }
