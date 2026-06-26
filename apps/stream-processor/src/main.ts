// apps/stream-processor/src/main.ts · process entry. Boots (fail-closed config) → Kafka client + producer →
// Postgres pool → the outbox TAILER (pg → Kafka) → the enabled consumer groups (Kafka → work) → an HTTP
// /healthz + /metrics endpoint. Each consumer runs in its own group so a slow concern never blocks another.
// Graceful shutdown on SIGTERM/SIGINT: stop the tailer, disconnect consumers + producer, drain the pool.
import http from 'node:http';
import { Kafka, logLevel } from 'kafkajs';
import { loadConfig } from './config';
import { Db } from './db';
import { StreamMetrics } from './metrics';
import { StreamProducer } from './messaging/producer';
import { ConsumerRuntime, ConsumerSpec } from './messaging/consumer-runtime';
import { IdempotencyStore } from './processing/idempotency';
import { DeadLetterHandler } from './dlq/dead-letter.handler';
import { OutboxTailer } from './ingestion/outbox-tailer';
import { OpenSearchWriter } from './downstream/opensearch.writer';
import { NotifierClient } from './downstream/notifier.client';
import { searchIndexerConsumer } from './consumers/search-indexer.consumer';
import { notificationFanoutConsumer } from './consumers/notification-fanout.consumer';
import { projectionBuilderConsumer } from './consumers/projection-builder.consumer';
import { fraudSignalConsumer } from './consumers/fraud-signal.consumer';
import { analyticsEtlConsumer } from './consumers/analytics-etl.consumer';
import { viewCounterConsumer } from './consumers/view-counter.consumer';

async function main(): Promise<void> {
  const cfg = loadConfig();                       // throws → exits on misconfig (fail closed)
  const log = (m: string) => console.log(`[stream-processor] ${m}`);   // eslint-disable-line no-console
  const metrics = new StreamMetrics();

  const kafka = new Kafka({ clientId: cfg.kafkaClientId, brokers: cfg.kafkaBrokers, logLevel: logLevel.ERROR });
  const producer = new StreamProducer(kafka);
  await producer.start();
  const db = new Db(cfg.databaseUrl);
  const idempotency = new IdempotencyStore(db);
  const dlq = new DeadLetterHandler(db, producer, metrics);

  // downstream clients (degrade to no-op when their URL is absent)
  const osWriter = new OpenSearchWriter(cfg.openSearchUrl, cfg.openSearchAuth, cfg.openSearchIndexPrefix);
  const notifier = new NotifierClient(cfg.notifierUrl, cfg.notifierApiKey);

  // assemble the enabled consumers
  const all: Record<string, ConsumerSpec> = {
    search_indexer: searchIndexerConsumer(osWriter),
    notification_fanout: notificationFanoutConsumer(notifier),
    projection_builder: projectionBuilderConsumer(),
    fraud_signal: fraudSignalConsumer(),
    view_counter: viewCounterConsumer(),
    analytics_etl: analyticsEtlConsumer(),
  };
  const runtime = new ConsumerRuntime(kafka, { db, producer, metrics, idempotency, dlq, log });
  for (const name of cfg.enabledConsumers) {
    const spec = all[name];
    if (!spec) { log(`unknown consumer '${name}' — skipping`); continue; }
    await runtime.run(spec);
    log(`consumer started: ${name}`);
  }

  // the ingestion tailer (pg outbox → Kafka) for this shard
  const tailer = new OutboxTailer(db, producer, metrics, cfg.shardNo, cfg.tailBatch, log);
  const signal = { aborted: false };
  void tailer.run(signal);
  log(`outbox tailer started (shard ${cfg.shardNo})`);

  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === '/healthz') { res.writeHead(200).end('ok'); return; }
    if (req.url === '/metrics') { res.writeHead(200, { 'content-type': 'text/plain' }).end(metrics.render()); return; }
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(Number(process.env.STREAM_HTTP_PORT ?? 8091), r));
  log('listening (health/metrics)');

  const shutdown = async () => {
    log('shutting down…');
    signal.aborted = true; tailer.stop();
    await runtime.stop();
    await producer.stop();
    await db.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[stream-processor] failed to start:', (err as Error)?.message ?? err);   // eslint-disable-line no-console
  process.exit(1);
});
