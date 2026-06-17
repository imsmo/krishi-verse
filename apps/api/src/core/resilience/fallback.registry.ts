// core/resilience/fallback.registry.ts · graceful degradation. When a wrapped call ultimately
// fails (timeout / circuit open / exhausted retries), run a fallback instead of failing the
// request — e.g. OpenSearch → DB query, AI grade → rule grade. SAFETY: money operations must
// NEVER have a fallback (a failed debit must fail, not silently "succeed"); the executor refuses.
export type Fallback<T> = (err: unknown) => Promise<T> | T;

/** Wrap `fn`; on failure, invoke `fallback`. Returns whichever resolves. */
export async function withFallback<T>(fn: () => Promise<T>, fallback: Fallback<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    return await fallback(err);
  }
}
