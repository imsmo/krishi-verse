// @krishi-verse/sdk-js · the transport. One bounded, resilient request primitive every resource client uses.
// Guarantees: a per-request timeout via AbortController (no hung renders); RETRY only for IDEMPOTENT GETs on
// transient failures (network/timeout/5xx) with exponential backoff + jitter — a mutation (POST/PATCH/…) is
// NEVER auto-retried (Law 3: a non-idempotent call must fail loudly, never silently double-fire); the API's
// {data, meta} envelope is unwrapped; a non-2xx becomes a typed SdkError carrying only safe fields (no token).
import { ResolvedConfig } from './config';
import { SdkError, SdkNetworkError, SdkTimeoutError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;       // required by the API for POSTs that mutate; passed through as a header
  signal?: AbortSignal;          // caller cancellation (composed with the timeout)
  anonymous?: boolean;           // skip attaching the bearer token (public endpoints)
}
export interface Envelope<T> { data: T; meta?: Record<string, unknown>; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpClient {
  constructor(private readonly config: ResolvedConfig) {}

  async request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<Envelope<T>> {
    const url = this.buildUrl(path, opts.query);
    const isIdempotent = method === 'GET';
    const maxAttempts = isIdempotent ? this.config.retries + 1 : 1;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.once<T>(method, url, opts);
      } catch (err) {
        lastErr = err;
        const retryable = isIdempotent && this.isRetryable(err) && attempt < maxAttempts;
        if (!retryable) throw err;
        await sleep(Math.min(1000, 100 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 50));   // backoff + jitter
      }
    }
    throw lastErr;   // unreachable, but satisfies the type
  }

  private async once<T>(method: HttpMethod, url: string, opts: RequestOptions): Promise<Envelope<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort);
    try {
      const res = await this.config.fetchImpl(url, {
        method,
        headers: await this.headers(method, opts),
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
      const text = await res.text();
      const json = text ? safeParse(text) : {};
      if (!res.ok) {
        const e = (json ?? {}) as { code?: string; message?: string; requestId?: string; [k: string]: unknown };
        throw new SdkError(e.code ?? 'API_ERROR', res.status, e.message ?? `HTTP ${res.status}`, e.requestId ?? res.headers.get('x-request-id') ?? undefined, e);
      }
      return (json && typeof json === 'object' && 'data' in (json as object)) ? (json as Envelope<T>) : { data: json as T };
    } catch (err) {
      if (err instanceof SdkError) throw err;
      if (controller.signal.aborted) throw new SdkTimeoutError(this.config.timeoutMs);
      throw new SdkNetworkError(err instanceof Error ? err.message : 'network error', err);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }

  private async headers(method: HttpMethod, opts: RequestOptions): Promise<Record<string, string>> {
    const h: Record<string, string> = { accept: 'application/json' };
    // Caller-supplied extra headers (e.g. a device-integrity risk signal) are applied FIRST so the reserved
    // headers below always win — a caller can never override auth/idempotency/tenant/content-type.
    if (this.config.getHeaders) {
      try {
        const extra = await this.config.getHeaders();
        for (const [k, v] of Object.entries(extra)) {
          const key = k.toLowerCase();
          if (key === 'authorization' || key === 'idempotency-key' || key === 'x-tenant-slug' || key === 'content-type' || key === 'accept') continue;
          if (typeof v === 'string') h[key] = v;
        }
      } catch { /* extra headers are best-effort; never block a request (degrade) */ }
    }
    if (opts.body !== undefined) h['content-type'] = 'application/json';
    if (this.config.tenantSlug) h['x-tenant-slug'] = this.config.tenantSlug;
    if (this.config.userAgent) h['user-agent'] = this.config.userAgent;
    if (opts.idempotencyKey && method !== 'GET') h['idempotency-key'] = opts.idempotencyKey;
    if (!opts.anonymous && this.config.getToken) {
      const token = await this.config.getToken();
      if (token) h.authorization = `Bearer ${token}`;
    }
    return h;
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const clean = path.replace(/^\/+/, '');
    let url = `${this.config.baseUrl}/${this.config.apiVersion}/${clean}`;
    if (query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) qs.append(k, String(v));
      const s = qs.toString();
      if (s) url += `?${s}`;
    }
    return url;
  }
  private isRetryable(err: unknown): boolean {
    if (err instanceof SdkTimeoutError) return true;
    if (err instanceof SdkNetworkError) return true;
    if (err instanceof SdkError) return err.status >= 500 || err.status === 429;
    return false;
  }
}
function safeParse(text: string): unknown { try { return JSON.parse(text); } catch { return { message: text.slice(0, 300) }; } }
