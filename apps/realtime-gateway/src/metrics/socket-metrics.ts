// apps/realtime-gateway/src/metrics/socket-metrics.ts · per-pod counters/gauges (§6). Plain in-process
// counters exposed at /metrics in Prometheus text format — no PII in labels (we never label by user/tenant
// id; only coarse reasons). Cheap so it can't itself become a bottleneck at millions of sockets.
export class SocketMetrics {
  private connections = 0;            // current open sockets (gauge)
  private readonly counters = new Map<string, number>();

  connOpened(): void { this.connections++; this.inc('rt_connections_opened_total'); }
  connClosed(): void { this.connections = Math.max(0, this.connections - 1); this.inc('rt_connections_closed_total'); }
  authFailed(): void { this.inc('rt_auth_failed_total'); }
  subscribed(): void { this.inc('rt_subscriptions_total'); }
  subDenied(reason: string): void { this.inc(`rt_subscribe_denied_total{reason="${reason}"}`); }
  messageOut(): void { this.inc('rt_messages_sent_total'); }
  messageDropped(): void { this.inc('rt_messages_dropped_total'); }
  slowConsumerEvicted(): void { this.inc('rt_slow_consumer_evicted_total'); }

  get activeConnections(): number { return this.connections; }

  private inc(key: string): void { this.counters.set(key, (this.counters.get(key) ?? 0) + 1); }

  /** Prometheus text exposition. */
  render(): string {
    const lines = [`rt_connections_active ${this.connections}`];
    for (const [k, v] of this.counters) lines.push(`${k} ${v}`);
    return lines.join('\n') + '\n';
  }
}
