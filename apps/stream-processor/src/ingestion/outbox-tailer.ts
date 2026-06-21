// apps/stream-processor/src/ingestion/outbox-tailer.ts · gets domain events onto the bus. It TAILS outbox_events
// by ascending id from a persisted checkpoint and publishes each to its ingest topic (keyed by tenant_id). This
// is an APPEND-ONLY reader: it never touches outbox_events.status, so it does NOT contend with the in-process
// dispatcher (which marks rows published after running its handlers) — multiple independent readers can each
// tail the same log at their own offset. At-least-once: the checkpoint advances only AFTER the broker acks the
// batch, so a crash re-publishes the tail and the consumers dedup.
//
// Concurrency: a SELECT … FOR UPDATE on the single checkpoint row serialises tailers per shard (a second pod
// blocks until the first commits), so the same rows aren't double-published within a shard.
import type { Db } from '../db';
import type { StreamProducer, OutMessage } from '../messaging/producer';
import type { StreamMetrics } from '../metrics';
import { toEnvelope, serialize } from '../envelope';
import { topicForEvent, partitionKey } from '../topics';

interface OutboxRow {
  id: string; tenant_id: string | null; aggregate_type: string; aggregate_id: string;
  event_type: string; payload: unknown; created_at: string;
}

export class OutboxTailer {
  private running = false;
  constructor(
    private readonly db: Db,
    private readonly producer: StreamProducer,
    private readonly metrics: StreamMetrics,
    private readonly shardNo: number,
    private readonly batch: number,
    private readonly log: (m: string) => void,
  ) {}

  /** One tick: claim the checkpoint, publish the next batch, advance. Returns rows published. */
  async tickOnce(): Promise<number> {
    return this.db.withTenantTx(null, async (c) => {
      // Lock this shard's checkpoint row (create on first run). Serialises tailers per shard.
      await c.query(
        `INSERT INTO stream_ingest_checkpoint (shard_no, last_outbox_id) VALUES ($1, 0)
           ON CONFLICT (shard_no) DO NOTHING`, [this.shardNo],
      );
      const cp = await c.query(`SELECT last_outbox_id FROM stream_ingest_checkpoint WHERE shard_no=$1 FOR UPDATE`, [this.shardNo]);
      const lastId = BigInt((cp.rows[0]?.last_outbox_id as string | number | undefined) ?? 0);

      const r = await c.query(
        `SELECT id, tenant_id, aggregate_type, aggregate_id, event_type, payload, created_at
           FROM outbox_events WHERE id > $1 ORDER BY id ASC LIMIT $2`,
        [lastId.toString(), this.batch],
      );
      const rows = r.rows as unknown as OutboxRow[];
      if (rows.length === 0) return 0;

      const messages: OutMessage[] = [];
      let maxId = lastId;
      for (const row of rows) {
        try {
          const ev = toEnvelope(row);
          messages.push({ topic: topicForEvent(ev.eventType), key: partitionKey(ev.tenantId), value: serialize(ev) });
          const rid = BigInt(row.id);
          if (rid > maxId) maxId = rid;
        } catch (e) {
          // a structurally-bad outbox row must not stall the tail; skip it but still advance past it
          this.log(`tailer: skipping malformed outbox row ${row.id}: ${(e as Error)?.message ?? 'err'}`);
          const rid = BigInt(row.id);
          if (rid > maxId) maxId = rid;
        }
      }

      // Publish BEFORE advancing the checkpoint (at-least-once). If the broker rejects, the tx rolls back and
      // the same window re-publishes next tick.
      await this.producer.sendBatch(messages);
      await c.query(`UPDATE stream_ingest_checkpoint SET last_outbox_id=$2, updated_at=now() WHERE shard_no=$1`, [this.shardNo, maxId.toString()]);
      this.metrics.tailed(rows.length);
      return rows.length;
    });
  }

  /** Run the tail loop until stopped: drain quickly when busy, back off when idle. */
  async run(signal: { aborted: boolean }, idleMs = 500, busyMs = 10): Promise<void> {
    this.running = true;
    while (this.running && !signal.aborted) {
      let n = 0;
      try { n = await this.tickOnce(); }
      catch (e) { this.log(`tailer tick error: ${(e as Error)?.message ?? 'err'}`); n = 0; }
      await new Promise<void>((res) => setTimeout(res, n > 0 ? busyMs : idleMs));
    }
  }

  stop(): void { this.running = false; }
}
