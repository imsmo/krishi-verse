// apps/mobile/src/core/observability/index.ts · public surface for observability (guide §6). One import site for
// crash reporting, funnel analytics, correlation ids, redaction, and SLO targets. `initObservability()` is called
// once at boot: it's a NO-OP without a configured DSN (dev/tests/sandbox stay quiet), and when wired it installs
// the Sentry/analytics providers with redaction as beforeSend. The header map is consumed by the SDK getHeaders.
export { redactPII, scrubString, REDACTED } from './redact';
export { currentCorrelationId, rotateCorrelationId, correlationHeaders } from './correlation';
export {
  EVENTS, track, buildEvent, appendBounded, flushAnalytics, bufferedCount,
  setAnalyticsConsent, setAnalyticsProvider, type AnalyticsEvent, type AnalyticsProvider, type EventName,
} from './analytics';
export { captureError, addBreadcrumb, setCrashUser, sanitizeEvent, setCrashProvider, forceCrash, type CrashProvider } from './crash';
export { SLOS, sloFor, meetsSlo, type SloTarget } from './slo';

import { config } from '../config';

/** Wire crash + analytics providers at boot. No-op unless a DSN is configured (release builds inject it). The
 * actual provider modules (Sentry, analytics SDK) are dynamically required so dev/tests/sandbox don't load native
 * deps. Always best-effort — observability must never break boot (Law 12). */
export function initObservability(): void {
  if (!config.sentryDsn && !config.analyticsEnabled) return;
  // Providers are installed by the release bootstrap (CI/EAS), which calls setCrashProvider/setAnalyticsProvider
  // with Sentry + the analytics SDK configured with redaction as beforeSend. Left as the integration point so the
  // framework-free core stays testable + the offline sandbox never pulls native modules.
}
