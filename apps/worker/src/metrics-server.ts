// apps/worker/src/metrics-server.ts · expose /metrics (Prometheus scrape) + /healthz on the worker process.
import * as http from 'node:http';
import { WorkerMetrics } from './metrics';

export function startMetricsServer(metrics: WorkerMetrics, port: number): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/metrics') { res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' }); res.end(metrics.render()); return; }
    if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"status":"ok"}'); return; }
    res.writeHead(404); res.end();
  });
  server.listen(port);
  return server;
}
