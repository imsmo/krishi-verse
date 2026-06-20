// apps/mobile/src/core/api/client.ts · the typed API client factory for the app, built on @krishi-verse/sdk-js
// (timeout + idempotent-GET retry + circuit-safe; money as string minor units; typed SdkError). The bearer token
// is supplied per-request by a getter the auth store registers, so a single client instance always sends the
// CURRENT token (no stale-token bug, no client churn on refresh). The tenant slug (white-label builds) is sent as
// X-Tenant-Slug. `anonClient()` is the tokenless client used only for the OTP login flow.
import { createClient, KrishiVerseClient } from '@krishi-verse/sdk-js';
import { config } from '../config';

let _accessTokenGetter: () => string | undefined = () => undefined;

/** The auth store calls this once so the client can read the live in-memory access token. */
export function registerAccessTokenGetter(fn: () => string | undefined): void {
  _accessTokenGetter = fn;
}

let _client: KrishiVerseClient | undefined;
/** The shared authenticated client (singleton — reads the live token each request). */
export function apiClient(): KrishiVerseClient {
  if (!_client) {
    _client = createClient({
      baseUrl: config.apiUrl,
      getToken: () => _accessTokenGetter(),
      tenantSlug: config.tenantSlug,
      timeoutMs: config.requestTimeoutMs,
      userAgent: config.userAgent,
    });
  }
  return _client;
}

/** Tokenless client for the pre-auth OTP flow. */
export function anonClient(): KrishiVerseClient {
  return createClient({ baseUrl: config.apiUrl, tenantSlug: config.tenantSlug, timeoutMs: config.requestTimeoutMs, userAgent: config.userAgent });
}
