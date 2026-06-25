// apps/worker/src/metrics.ts · tiny Prometheus registry (valid names) the worker exposes at /metrics, so the
// kv_* gauges the P0-6 alerts reference (kv_recon_mismatches, kv_outbox_pending, kv_partition_days_ahead, …) are
// scrapeable. Mirrors the api's sanitisation: metric names must match [a-zA-Z_:][a-zA-Z0-9_:]*.
const sanitize = (n: string) => n.replace(/[^a-zA-Z0-9_:]/g, '_');

export class WorkerMetrics {
  private gauges = new Map<string, number>();
  private counters = new Map<string, number>();
  private samples = new Map<string, number[]>();

  setGauge(name: string, value: number, labels?: Record<string, string>) { this.gauges.set(this.key(name, labels), value); }
  inc(name: string, labels?: Record<string, string>, by = 1) { const k = this.key(name, labels); this.counters.set(k, (this.counters.get(k) ?? 0) + by); }
  observe(name: string, ms: number, labels?: Record<string, string>) { const k = this.key(name, labels); const a = this.samples.get(k) ?? []; a.push(ms); if (a.length > 1024) a.shift(); this.samples.set(k, a); }

  private key(name: string, labels?: Record<string, string>): string {
    const n = sanitize(name);
    if (!labels) return n;
    const parts = Object.keys(labels).sort().map((k) => `${sanitize(k)}="${String(labels[k]).replace(/(["\\\n])/g, '\\$1')}"`);
    return `${n}{${parts.join(',')}}`;
  }
  private base(k: string): string { const i = k.indexOf('{'); return i === -1 ? k : k.slice(0, i); }

  render(): string {
    const lines: string[] = []; const typed = new Set<string>();
    const type = (b: string, t: string) => { if (!typed.has(b)) { typed.add(b); lines.push(`# TYPE ${b} ${t}`); } };
    for (const [k, v] of this.gauges) { type(this.base(k), 'gauge'); lines.push(`${k} ${v}`); }
    for (const [k, v] of this.counters) { type(this.base(k), 'counter'); lines.push(`${k} ${v}`); }
    for (const [k, arr] of this.samples) {
      const b = this.base(k); type(b, 'summary');
      const s = [...arr].sort((a, c) => a - c); const q = (p: number) => s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
      const lbl = k.includes('{') ? k.slice(k.indexOf('{')) : '';
      const wq = k.includes('{') ? k.slice(0, -1) + ',' : k + '{';
      lines.push(`${wq}quantile="0.5"} ${q(50)}`, `${wq}quantile="0.99"} ${q(99)}`, `${b}_count${lbl} ${arr.length}`, `${b}_sum${lbl} ${arr.reduce((a, c) => a + c, 0)}`);
    }
    return lines.join('\n') + '\n';
  }
}
