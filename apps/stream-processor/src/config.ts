// apps/stream-processor/src/config.ts · fail-closed configuration (§4: refuse to start insecure/misconfigured
// in production). The stream-processor connects to Kafka (the bus) and Postgres (outbox tail + idempotency
// ledger) under the kv_relay BYPASSRLS role (cross-tenant infra, like the relay). Optional downstreams
// (OpenSearch, notifier) degrade to no-op when their URL is absent (Law 12).

export interface StreamConfig {
  prod: boolean;
  shardNo: number;                    // this tailer's logical shard (one checkpoint row per shard)
  kafkaBrokers: string[];
  kafkaClientId: string;
  databaseUrl: string;
  openSearchUrl: string | null;
  openSearchAuth: string | null;      // "user:pass" → basic auth, or null
  openSearchIndexPrefix: string;
  notifierUrl: string | null;
  notifierApiKey: string | null;
  tailBatch: number;                  // max outbox rows per tail tick
  consumerConcurrency: number;        // max in-flight messages per consumer
  enabledConsumers: string[];         // concern names to run (subset of CONSUMER_SUBSCRIPTIONS)
}

function csv(v: string | undefined, fallback: string[] = []): string[] {
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): StreamConfig {
  const prod = (env.NODE_ENV ?? 'development') === 'production';
  const cfg: StreamConfig = {
    prod,
    shardNo: Number(env.STREAM_SHARD_NO ?? 0),
    kafkaBrokers: csv(env.KAFKA_BROKERS, prod ? [] : ['localhost:9092']),
    kafkaClientId: env.KAFKA_CLIENT_ID ?? 'kv-stream-processor',
    databaseUrl: env.DATABASE_URL ?? '',
    openSearchUrl: env.OPENSEARCH_URL ?? null,
    openSearchAuth: env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD ? `${env.OPENSEARCH_USERNAME}:${env.OPENSEARCH_PASSWORD}` : null,
    openSearchIndexPrefix: env.OPENSEARCH_INDEX_PREFIX ?? 'kv',
    notifierUrl: env.NOTIFIER_URL ?? null,
    notifierApiKey: env.NOTIFIER_API_KEY ?? null,
    tailBatch: Math.max(1, Math.min(1000, Number(env.STREAM_TAIL_BATCH ?? 200))),
    consumerConcurrency: Math.max(1, Math.min(64, Number(env.STREAM_CONSUMER_CONCURRENCY ?? 8))),
    enabledConsumers: csv(env.STREAM_CONSUMERS, ['search_indexer', 'notification_fanout', 'projection_builder', 'fraud_signal', 'analytics_etl']),
  };

  const problems: string[] = [];
  if (prod && cfg.kafkaBrokers.length === 0) problems.push('KAFKA_BROKERS (comma-separated host:port)');
  if (!cfg.databaseUrl) problems.push('DATABASE_URL');
  if (problems.length) throw new Error(`stream-processor refusing to start — misconfigured: ${problems.join(', ')}`);
  return cfg;
}
