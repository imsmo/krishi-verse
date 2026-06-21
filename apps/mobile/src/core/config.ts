// apps/mobile/src/core/config.ts · the ONLY reader of runtime env for the app. Values come from Expo's
// `extra` (app.config) surfaced via expo-constants. Fails CLOSED: if the API origin is missing we refuse to
// produce a client (a misconfigured build must not silently talk to the wrong backend). No secrets ever live in
// the client bundle — only the public API origin and the default tenant slug.
import Constants from 'expo-constants';

interface RawExtra { apiUrl?: string; tenantSlug?: string; appEnv?: string; razorpayKeyId?: string; tenantConsoleUrl?: string; appVersion?: string; minSupportedVersion?: string; androidStoreUrl?: string; iosStoreUrl?: string; privacyUrl?: string; termsUrl?: string }
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
  /** App version + the server/store-driven minimum supported version (forced-update floor, §8). Both optional;
   * the app-update screen only forces an update when both are set AND current < min. Public, non-secret. */
  appVersion: extra.appVersion ?? process.env.EXPO_PUBLIC_APP_VERSION ?? '0.0.0',
  minSupportedVersion: extra.minSupportedVersion ?? process.env.EXPO_PUBLIC_MIN_VERSION ?? undefined,
  /** Public store + legal URLs (https). Optional — screens that link to them hide the link if unset. */
  androidStoreUrl: extra.androidStoreUrl ?? process.env.EXPO_PUBLIC_ANDROID_STORE_URL ?? undefined,
  iosStoreUrl: extra.iosStoreUrl ?? process.env.EXPO_PUBLIC_IOS_STORE_URL ?? undefined,
  privacyUrl: extra.privacyUrl ?? process.env.EXPO_PUBLIC_PRIVACY_URL ?? undefined,
  termsUrl: extra.termsUrl ?? process.env.EXPO_PUBLIC_TERMS_URL ?? undefined,
  /** Crash-reporter DSN (public client key, not a secret). Observability is a no-op when unset (dev/sandbox). */
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? undefined,
  /** Whether funnel analytics is built into this build (still gated by per-user consent at runtime). */
  analyticsEnabled: (process.env.EXPO_PUBLIC_ANALYTICS_ENABLED ?? 'false') === 'true',
  requestTimeoutMs: 12000, // mobile networks are slow; bound every call (Law 12)
  userAgent: 'kv-mobile',
});
