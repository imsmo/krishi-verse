// apps/web-admin/src/lib/admin-client.ts · a thin, resilient fetch client for admin-api (the tenant SDK doesn't
// cover the god-mode realm). Attaches the admin bearer (server-side only), bounds every call with a timeout,
// retries idempotent GETs, unwraps {data,meta}, and maps non-2xx to a typed AdminApiError WITHOUT leaking the
// token. A 403 from admin-api means owner-perm / hardware-key / step-up was not satisfied — surfaced as
// `needsElevation` so the UI can prompt re-auth (admin-api is the authority; the UI only reflects it).
import 'server-only';
import { env } from './env';
import { getAdminToken } from './admin-auth';

export class AdminApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly requestId?: string) { super(message); this.name = 'AdminApiError'; }
  get needsElevation() { return this.status === 403; }   // hardware-key / step-up / owner perm required
  get unauthorized() { return this.status === 401; }
}
interface Envelope<T> { data: T; meta?: Record<string, unknown>; }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once<T>(method: string, path: string, query?: Record<string, string | number | undefined>): Promise<Envelope<T>> {
  const url = new URL(`${env.serverAdminApiUrl.replace(/\/+$/, '')}/v1/${path.replace(/^\/+/, '')}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.append(k, String(v));
  const token = getAdminToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method, headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, signal: controller.signal, cache: 'no-store' });
    const text = await res.text(); const json = text ? JSON.parse(text) : {};
    if (!res.ok) { const e = json as any; throw new AdminApiError(e?.code ?? 'ADMIN_API_ERROR', res.status, e?.message ?? `HTTP ${res.status}`, e?.requestId); }
    return (json && 'data' in json) ? json as Envelope<T> : { data: json as T };
  } finally { clearTimeout(timer); }
}

/** Idempotent GET to admin-api with a bounded retry on transient failure. */
export async function adminGet<T>(path: string, query?: Record<string, string | number | undefined>): Promise<Envelope<T>> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await once<T>('GET', path, query); }
    catch (e) { lastErr = e; const retry = e instanceof AdminApiError ? e.status >= 500 : true; if (!retry || attempt === 3) throw e; await sleep(100 * attempt); }
  }
  throw lastErr;
}
