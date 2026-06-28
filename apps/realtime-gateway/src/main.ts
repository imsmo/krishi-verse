// apps/realtime-gateway/src/main.ts · process entry. Boots: fail-closed config → HTTP server (health +
// /metrics) → WebSocketServer (upgrade) → Redis subscriber → RedisPubSubAdapter wiring Redis → ws fan-out.
// Stateless pod behind a sticky LB; scale = add pods. Graceful shutdown on SIGTERM/SIGINT.
import 'dotenv/config'; // load apps/realtime-gateway/.env BEFORE loadConfig reads it (local dev; no-ops in prod where env is injected)
import http from 'node:http';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import { loadConfig } from './config';
import { WsServer } from './ws-server';
import { RedisPubSubAdapter } from './pubsub/redis-pubsub.adapter';
import { SocketMetrics } from './metrics/socket-metrics';

async function main(): Promise<void> {
  const cfg = loadConfig();                       // throws (exits) on insecure prod config — fail closed
  const metrics = new SocketMetrics();

  const httpServer = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === '/healthz') { res.writeHead(200).end('ok'); return; }
    if (req.url === '/metrics') { res.writeHead(200, { 'content-type': 'text/plain' }).end(metrics.render()); return; }
    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 4096 });
  const gateway = new WsServer(wss, { jwt: cfg.jwt, limits: cfg.limits, metrics });

  // Dedicated subscriber connection (a subscribing ioredis client can't issue other commands).
  const sub = new Redis(cfg.redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  const pubsub = new RedisPubSubAdapter(sub, (channel, payload) => gateway.dispatch(channel, payload));
  await pubsub.start();

  await new Promise<void>((resolve) => httpServer.listen(cfg.port, resolve));
  // eslint-disable-next-line no-console
  console.log(`realtime-gateway listening on :${cfg.port} (ws path /ws)`);

  const shutdown = async () => {
    try { await pubsub.stop(); } catch { /* noop */ }
    try { sub.disconnect(); } catch { /* noop */ }
    wss.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();   // hard stop if connections linger
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('realtime-gateway failed to start:', (err as Error)?.message ?? err);
  process.exit(1);
});
