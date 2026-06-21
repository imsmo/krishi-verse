// apps/mobile/src/core/observability/correlation.ts · client correlation id (guide §6). Each request carries an
// `x-correlation-id` so a client action can be tied to its server log line + any crash/analytics event from the
// same flow. The id is a random, NON-PII token (no device id, no phone). The SDK reads the server's own
// `x-request-id` off responses for errors; this is the OUTBOUND counterpart. PURE id gen + a small current-id
// holder; the header map is consumed by the SDK `getHeaders` hook.
// A correlation id is a trace TAG, not a security token — it needs uniqueness, not crypto strength, so we generate
// it locally (no expo-crypto dependency, keeping this module framework-free + unit-testable). PII-free by design.
function traceId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

let current = traceId();

/** Rotate the correlation id (call on app foreground / new top-level flow so unrelated actions don't share one). */
export function rotateCorrelationId(): string { current = traceId(); return current; }
export function currentCorrelationId(): string { return current; }

/** Header map merged into every request (PII-free). */
export function correlationHeaders(): Record<string, string> {
  return { 'x-correlation-id': current };
}
