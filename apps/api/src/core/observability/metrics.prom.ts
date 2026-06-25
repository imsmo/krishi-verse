// core/observability/metrics.prom.ts
// Concrete Metrics: in-process counters + latency summaries with a Prometheus
// text exposition (scraped at GET /metrics). Zero external deps. Histograms are
// summarised (count/sum + p50/p95/p99 from a bounded reservoir) — enough for
// SLO dashboards without pulling a metrics library into Phase 1.
import { Injectable } from '@nestjs/common';
import { Metrics } from './metrics';

// Prometheus metric names must match [a-zA-Z_:][a-zA-Z0-9_:]* — our use-case names use dots
// (e.g. "auth.request_otp"), so sanitise to underscores. Without this, the scrape parser rejects the series.
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_:]/g, '_');
}

function labelKey(name: string, labels?: Record<string, string>): string {
  const n = sanitize(name);
  if (!labels) return n;
  const parts = Object.keys(labels).sort().map((k) => `${sanitize(k)}="${String(labels[k]).replace(/(["\\\n])/g, '\\$1')}"`);
  return `${n}{${parts.join(',')}}`;
}

/** Base metric name (strip any label set) from a series key. */
function baseName(key: string): string {
  const i = key.indexOf('{');
  return i === -1 ? key : key.slice(0, i);
}

@Injectable()
export class PromMetrics extends Metrics {
  private readonly counters = new Map<string, number>();
  private readonly samples = new Map<string, number[]>(); // bounded reservoir per series

  inc(name: string, labels?: Record<string, string>, by = 1): void {
    const k = labelKey(name, labels);
    this.counters.set(k, (this.counters.get(k) ?? 0) + by);
  }
  observe(name: string, valueMs: number, labels?: Record<string, string>): void {
    const k = labelKey(name, labels);
    const arr = this.samples.get(k) ?? [];
    arr.push(valueMs);
    if (arr.length > 2048) arr.shift();
    this.samples.set(k, arr);
  }

  /** Prometheus text exposition format (valid names + # TYPE lines). */
  render(): string {
    const lines: string[] = [];
    const typed = new Set<string>();
    const emitType = (base: string, type: 'counter' | 'summary') => {
      if (!typed.has(base)) { typed.add(base); lines.push(`# TYPE ${base} ${type}`); }
    };

    for (const [k, v] of this.counters) { emitType(baseName(k), 'counter'); lines.push(`${k} ${v}`); }
    for (const [k, arr] of this.samples) {
      const base = baseName(k);
      emitType(base, 'summary');
      const sorted = [...arr].sort((a, b) => a - b);
      const q = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;
      const withQ = k.includes('{') ? k.slice(0, -1) + ',' : k + '{';
      lines.push(`${withQ}quantile="0.5"} ${q(50)}`);
      lines.push(`${withQ}quantile="0.95"} ${q(95)}`);
      lines.push(`${withQ}quantile="0.99"} ${q(99)}`);
      lines.push(`${base}_count${k.includes('{') ? k.slice(k.indexOf('{')) : ''} ${arr.length}`);
      lines.push(`${base}_sum${k.includes('{') ? k.slice(k.indexOf('{')) : ''} ${arr.reduce((a, b) => a + b, 0)}`);
    }
    return lines.join('\n') + '\n';
  }
}
