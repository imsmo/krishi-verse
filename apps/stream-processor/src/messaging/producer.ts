// apps/stream-processor/src/messaging/producer.ts · thin KafkaJS producer wrapper. Used by the outbox tailer
// (ingest topics) and by consumers that emit derived events (fraud signals, analytics, DLQ). Idempotent
// producer (enable.idempotence) so a retried send doesn't duplicate; acks=all for durability. Messages are
// keyed by tenant_id (partitionKey) to preserve per-tenant ordering.
import { Kafka, Producer, CompressionTypes } from 'kafkajs';

export interface OutMessage { topic: string; key: string; value: string; }

export class StreamProducer {
  private readonly producer: Producer;
  private connected = false;
  constructor(kafka: Kafka) {
    this.producer = kafka.producer({ idempotent: true, maxInFlightRequests: 5, allowAutoTopicCreation: true });
  }

  async start(): Promise<void> { if (!this.connected) { await this.producer.connect(); this.connected = true; } }
  async stop(): Promise<void> { if (this.connected) { await this.producer.disconnect().catch(() => undefined); this.connected = false; } }

  /** Send a batch grouped by topic. acks=all + idempotent producer = durable, dedup-on-retry. */
  async sendBatch(messages: OutMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const byTopic = new Map<string, { key: string; value: string }[]>();
    for (const m of messages) {
      const list = byTopic.get(m.topic) ?? [];
      list.push({ key: m.key, value: m.value });
      byTopic.set(m.topic, list);
    }
    await this.producer.sendBatch({
      acks: -1,
      compression: CompressionTypes.GZIP,
      topicMessages: [...byTopic.entries()].map(([topic, msgs]) => ({ topic, messages: msgs })),
    });
  }

  async send(topic: string, key: string, value: string): Promise<void> {
    await this.sendBatch([{ topic, key, value }]);
  }
}
