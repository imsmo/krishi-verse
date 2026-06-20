// core/search/index-builder.service.ts · builds + maintains the OpenSearch projections (the "index-builders").
// ensureIndices() creates missing indices with their mappings at deploy/boot. syncById() is the per-aggregate
// re-sync the outbox handler calls: it RE-READS the current source row (single source of truth = Postgres) and
// either upserts the projected doc or deletes it (isIndexable decides) — so the index is eventually consistent
// with the DB regardless of which event fired. All writes route through the resilience-wrapped transport.
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics } from '../observability/metrics';
import { OpenSearchTransport } from './opensearch.transport';
import { IndexDef } from './indices/index-def';
import { ALL_INDICES } from './indices/index-registry';

/** Minimal read surface (a relay TxContext or a Pool both satisfy this). */
export interface RowReader { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>; }

@Injectable()
export class IndexBuilderService {
  constructor(
    @Inject(OpenSearchTransport) private readonly transport: OpenSearchTransport,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  get enabled(): boolean { return this.transport.enabled; }

  /** Create every registered index (idempotent — skips ones that already exist). Run at deploy/startup. */
  async ensureIndices(): Promise<void> {
    for (const def of ALL_INDICES) await this.transport.ensureIndex(def.logical, def.body);
  }

  /** Re-sync one aggregate by id: read the current row, then upsert (if indexable) or delete. */
  async syncById(reader: RowReader, def: IndexDef, id: string): Promise<'upserted' | 'removed'> {
    const r = await reader.query(`SELECT * FROM ${def.source.table} WHERE ${def.source.idCol} = $1`, [id]);
    const row = r.rows[0];
    if (!row || !def.isIndexable(row)) {
      await this.transport.deleteDoc(def.logical, id);
      this.metrics.inc('search.index.removed', { index: def.logical });
      return 'removed';
    }
    const { id: docId, doc } = def.project(row);
    await this.transport.indexDoc(def.logical, docId, doc);
    this.metrics.inc('search.index.upserted', { index: def.logical });
    return 'upserted';
  }
}
