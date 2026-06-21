// apps/stream-processor/src/messaging/consumer-runtime.ts · the shared consumer loop every concern runs on.
// For each message: parse → dedup-check (skip if already processed) → run the concern's handler with our OWN
// retry/backoff loop → on success record processed; on permanent/exhausted failure → DLQ. We CATCH everything
// inside eachMessage and never rethrow, so the offset commits and one poison message can't block the partition
// forever (head-of-line blocking is the classic stream outage). Side effects are idempotent, so committing the
// offset after recording (or after a safe redelivery) is correct at-least-once.
import { Kafka, Consumer } from 'kafkajs';
import type { Db } from '../db';
import type { StreamProducer } from '../messaging/producer';
import type { StreamMetrics } from '../metrics';
import type { IdempotencyStore } from '../processing/idempotency';
import type { DeadLetterHandler } from '../dlq/dead-letter.handler';
import { parse, StreamEvent } from '../envelope';
import { classify, decideRetry, RetryConfig, DEFAULT_RETRY } from '../processing/retry-policy';

export interface ConsumerContext {
  db: Db;
  producer: StreamProducer;
  metrics: StreamMetrics;
  log: (msg: string) => void;
}

/** A concern's handler. Throw to fail (transient → retried; PoisonMessageError/permanent → straight to DLQ).
 *  Handlers MUST be idempotent: the same event may be delivered again after a crash. */
export interface ConsumerSpec {
  readonly concern: string;
  readonly groupId: string;
  readonly topics: readonly string[];
  handle(ev: StreamEvent, ctx: ConsumerContext): Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class ConsumerRuntime {
  private readonly consumers: Consumer[] = [];
  constructor(
    private readonly kafka: Kafka,
    private readonly deps: { db: Db; producer: StreamProducer; metrics: StreamMetrics; idempotency: IdempotencyStore; dlq: DeadLetterHandler; log: (m: string) => void },
    private readonly retry: RetryConfig = DEFAULT_RETRY,
  ) {}

  async run(spec: ConsumerSpec): Promise<void> {
    const consumer = this.kafka.consumer({ groupId: spec.groupId, sessionTimeout: 30_000, heartbeatInterval: 3_000 });
    await consumer.connect();
    for (const t of spec.topics) await consumer.subscribe({ topic: t, fromBeginning: false });
    const ctx: ConsumerContext = { db: this.deps.db, producer: this.deps.producer, metrics: this.deps.metrics, log: this.deps.log };

    await consumer.run({
      eachMessage: async ({ message }) => {
        this.deps.metrics.consumed(spec.concern);
        const ev = parse(message.value ?? null);
        if (!ev) { await this.dlqRaw(spec.concern, message.value); return; }    // unparseable → DLQ, never crash
        try {
          if (await this.deps.idempotency.alreadyProcessed(spec.concern, ev.eventId)) {
            this.deps.metrics.duplicate(spec.concern);                          // redelivery → no-op
            return;
          }
          await this.process(spec, ev, ctx);
        } catch (err) {
          // a failure in our own control flow (e.g. dedup query) — log; the offset still commits and Kafka's
          // lag/our DLQ surface it. Never rethrow (would wedge the partition).
          this.deps.log(`[${spec.concern}] fatal dispatch error for event ${ev.eventId}: ${(err as Error)?.message ?? 'err'}`);
        }
      },
    });
    this.consumers.push(consumer);
  }

  /** Run the concern handler with bounded retry/backoff; record processed on success, DLQ on give-up. */
  private async process(spec: ConsumerSpec, ev: StreamEvent, ctx: ConsumerContext): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await spec.handle(ev, ctx);
        await this.deps.idempotency.markProcessed(spec.concern, ev.eventId, ev.tenantId, ev.eventType);
        this.deps.metrics.processed(spec.concern);
        return;
      } catch (err) {
        const decision = decideRetry(attempt, classify(err), this.retry);
        if (decision.action === 'dead_letter') {
          await this.deps.dlq.deadLetter(spec.concern, ev, decision.reason, (err as Error)?.message ?? 'error', attempt);
          return;
        }
        this.deps.metrics.retried(spec.concern);
        await sleep(decision.delayMs);
      }
    }
  }

  private async dlqRaw(concern: string, raw: Buffer | null): Promise<void> {
    // We couldn't parse an event id, so synthesize a minimal envelope for the DLQ record (event_id 0 = unknown).
    const stub: StreamEvent = { eventId: 0, tenantId: null, aggregateType: '', aggregateId: '', eventType: 'unparseable', payload: { raw: raw ? raw.toString('utf8').slice(0, 2000) : null }, occurredAt: '', v: 1 };
    await this.deps.dlq.deadLetter(concern, stub, 'permanent', 'unparseable message', 1);
  }

  async stop(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.disconnect().catch(() => undefined)));
  }
}
