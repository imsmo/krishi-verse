// apps/mobile/src/core/observability/crash.ts · crash + error reporting (guide §6). A provider port (Sentry in
// production) injected at boot; the default no-op keeps dev/tests/the offline sandbox safe. EVERYTHING reported
// is PII/token-redacted via redactPII (the provider's beforeSend must also call sanitizeEvent as defence-in-
// depth). The user context is the user id ONLY (no phone/name/email). Source maps are uploaded PRIVATELY + the
// crash is symbolicated server-side (CI step). `forceCrash()` exists to satisfy the DoD ("a forced crash is
// captured + symbolicated") from a hidden dev affordance — it is never wired into a user path.
import { redactPII, scrubString } from './redact';
import { currentCorrelationId } from './correlation';

export interface CrashProvider {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void;
  setUser(userId: string | null): void;
}

let provider: CrashProvider | null = null;
export function setCrashProvider(p: CrashProvider | null): void { provider = p; }

/** Sanitize a crash event payload before it leaves the device — redact context + message. Use this in the
 * provider's beforeSend too (belt-and-braces). PURE. */
export function sanitizeEvent(evt: { message?: string; context?: Record<string, unknown> }): { message?: string; context?: Record<string, unknown> } {
  return {
    message: evt.message != null ? scrubString(evt.message) : undefined,
    context: evt.context ? (redactPII(evt.context) as Record<string, unknown>) : undefined,
  };
}

/** Report a handled error with redacted context + the correlation id. Best-effort (never throws). */
export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
  if (!provider) return;
  try {
    const safe = redactPII({ ...context, correlationId: currentCorrelationId() }) as Record<string, unknown>;
    provider.captureException(error, safe);
  } catch { /* never let reporting crash the app */ }
}

/** Leave a redacted breadcrumb (navigation, action). Best-effort. */
export function addBreadcrumb(category: string, message: string, data: Record<string, unknown> = {}): void {
  if (!provider) return;
  try { provider.addBreadcrumb(category, scrubString(message), redactPII(data) as Record<string, unknown>); }
  catch { /* no-op */ }
}

/** Attach the user id ONLY (no PII) so crashes can be grouped per user; null clears it on sign-out. */
export function setCrashUser(userId: string | null): void {
  if (!provider) return;
  try { provider.setUser(userId); } catch { /* no-op */ }
}

/** DoD hook: force a crash to verify capture + symbolication in a build. Behind a dev-only affordance only. */
export function forceCrash(): never { throw new Error('KV forced crash (observability verification)'); }
