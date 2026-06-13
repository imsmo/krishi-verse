// core/observability/metrics.ts · counters/histograms (Prometheus/OTel) + tracing helper.
export abstract class Metrics {
  abstract inc(name: string, labels?: Record<string, string>, by?: number): void;
  abstract observe(name: string, valueMs: number, labels?: Record<string, string>): void;
}
export const METRICS = Symbol('METRICS');
/** Wrap an async op in a timed span; records duration + success/error metric. */
export async function timed<T>(m: Metrics, name: string, labels: Record<string,string>, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try { const r = await fn(); m.observe(name, Date.now() - t0, { ...labels, ok: 'true' }); return r; }
  catch (e) { m.observe(name, Date.now() - t0, { ...labels, ok: 'false' }); throw e; }
}
