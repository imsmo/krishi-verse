// apps/mobile/src/core/config.ts · the ONLY reader of runtime env for the app. Values come from Expo's
// `extra` (app.config) surfaced via expo-constants. Fails CLOSED: if the API origin is missing we refuse to
// produce a client (a misconfigured build must not silently talk to the wrong backend). No secrets ever live in
// the client bundle — only the public API origin and the default tenant slug.
import Constants from 'expo-constants';

interface RawExtra { apiUrl?: string; tenantSlug?: string; appEnv?: string; razorpayKeyId?: string; tenantConsoleUrl?: string }
const extra = ((Constants.expoConfig?.extra ?? {}) as RawExtra);

const apiUrl = extra.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  // Fail closed — surfaced at boot, never a silent default.
  throw new Error('mobile config: EXPO_PUBLIC_API_URL (or expo extra.apiUrl) is required');
}

export const config = Object.freeze({
  apiUrl,
  /** Optional default tenant slug for single-tenant white-label builds; multi-tenant builds set it post-login. */
  tenantSlug: extra.tenantSlug ?? process.env.EXPO_PUBLIC_TENANT_SLUG ?? undefined,
  appEnv: extra.appEnv ?? process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  isProduction: (extra.appEnv ?? process.env.EXPO_PUBLIC_APP_ENV) === 'production',
  /** Razorpay PUBLISHABLE key id (rzp_…). Public by design (not a secret); only needed for the checkout flow.
   * Optional at boot — the add-money flow surfaces a friendly error if it's unset. */
  razorpayKeyId: extra.razorpayKeyId ?? process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? undefined,
  /** Tenant web-console origin (apps/web-tenant) for the tenant-admin "heavy editing deep-links to web" handoffs
   * (P-18). Public, https. Optional — if unset, the handoff buttons explain the console isn't configured rather
   * than opening a bad URL. */
  tenantConsoleUrl: extra.tenantConsoleUrl ?? process.env.EXPO_PUBLIC_TENANT_CONSOLE_URL ?? undefined,
  requestTimeoutMs: 12000, // mobile networks are slow; bound every call (Law 12)
  userAgent: 'kv-mobile',
});
