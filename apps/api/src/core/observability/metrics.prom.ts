// core/observability/metrics.prom.ts
// Concrete Metrics: in-process counters + latency summaries with a Prometheus
// text exposition (scraped at GET /metrics). Zero external deps. Histograms are
// summarised (count/sum + p50/p95/p99 from a bounded reservoir) — enough for
// SLO dashboards without pulling a metrics library into Phase 1.
import { Injectable } from '@nestjs/common';
import { Metrics } from './metrics';

function labelKey(name: string, labels?: Record<string, string>): string {
  if (!labels) return name;
  const parts = Object.keys(labels).sort().map((k) => `${k}="${labels[k]}"`);
  return `${name}{${parts.join(',')}}`;
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

  /** Prometheus text exposition format. */
  render(): string {
    const lines: string[] = [];
    for (const [k, v] of this.counters) lines.push(`${k} ${v}`);
    for (const [k, arr] of this.samples) {
      const sorted = [...arr].sort((a, b) => a - b);
      const q = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;
      const base = k.includes('{') ? k.slice(0, -1) + ',' : k + '{';
      lines.push(`${base}quantile="0.5"} ${q(50)}`);
      lines.push(`${base}quantile="0.95"} ${q(95)}`);
      lines.push(`${base}quantile="0.99"} ${q(99)}`);
      lines.push(`${k}_count ${arr.length}`);
      lines.push(`${k}_sum ${arr.reduce((a, b) => a + b, 0)}`);
    }
    return lines.join('\n') + '\n';
  }
}
