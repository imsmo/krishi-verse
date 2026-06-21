// apps/stream-processor/src/metrics.ts · per-pod counters (§6). Plain in-process counters; exposed at /metrics
// in Prometheus text. Labels are coarse (concern, topic, reason) — never tenant/user id or any PII.
export class StreamMetrics {
  private readonly counters = new Map<string, number>();
  private inc(key: string, n = 1): void { this.counters.set(key, (this.counters.get(key) ?? 0) + n); }

  tailed(n: number): void { this.inc('sp_outbox_tailed_total', n); }
  published(topic: string, n = 1): void { this.inc(`sp_published_total{topic="${topic}"}`, n); }
  consumed(concern: string): void { this.inc(`sp_consumed_total{concern="${concern}"}`); }
  duplicate(concern: string): void { this.inc(`sp_duplicate_skipped_total{concern="${concern}"}`); }
  processed(concern: string): void { this.inc(`sp_processed_total{concern="${concern}"}`); }
  retried(concern: string): void { this.inc(`sp_retried_total{concern="${concern}"}`); }
  deadLettered(concern: string, reason: string): void { this.inc(`sp_dead_lettered_total{concern="${concern}",reason="${reason}"}`); }
  downstreamFail(dep: string): void { this.inc(`sp_downstream_fail_total{dep="${dep}"}`); }

  render(): string {
    const lines: string[] = [];
    for (const [k, v] of this.counters) lines.push(`${k} ${v}`);
    return lines.join('\n') + '\n';
  }
}
