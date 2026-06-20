// core/search/opensearch.transport.ts · the low-level OpenSearch REST transport (the ONLY place that talks to
// the cluster). Every call is wrapped in core/resilience under the 'opensearch' dependency (timeout + retry +
// circuit-breaker + bulkhead — Law 12: a hung/dead search cluster must NEVER cascade into the write path).
// Self-contained over global fetch (no SDK). Reads/searches are retryable; doc writes are idempotent (upsert/
// delete by id) so they are retryable too. Mutating the catalogue or money is NEVER done here — this only
// projects already-committed rows into a search index.
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { ResilienceService } from '../resilience/resilience.service';
import { InfraError } from '../../shared/errors/app-error';

const DEP = 'opensearch';

export interface BulkOp { id: string; doc?: Record<string, unknown>; delete?: boolean; }

@Injectable()
export class OpenSearchTransport {
  private readonly base: string | null;
  private readonly authHeader: string | null;
  readonly prefix: string;

  constructor(private readonly config: AppConfig, private readonly resilience: ResilienceService) {
    const s = this.config.search;
    this.base = s.url ? s.url.replace(/\/+$/, '') : null;
    this.prefix = s.indexPrefix;
    this.authHeader = s.username && s.password ? `Basic ${Buffer.from(`${s.username}:${s.password}`).toString('base64')}` : null;
    // A search outage must fail fast and shed, not stall request threads.
    this.resilience.configure(DEP, { timeoutMs: 4000, retries: 2, bulkhead: { maxConcurrent: 16, maxQueue: 64 }, circuit: { failureThreshold: 5, resetMs: 15_000, halfOpenMax: 2 } });
  }

  get enabled(): boolean { return this.base !== null; }
  /** Fully-qualified, prefixed index name (e.g. kv_listings). */
  indexName(logical: string): string { return `${this.prefix}_${logical}`; }

  private async request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.base) throw new InfraError('SEARCH_NOT_CONFIGURED', 'opensearch not configured');
    return this.resilience.run<T>(DEP, async () => {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.authHeader) headers.authorization = this.authHeader;
      const res = await fetch(`${this.base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await res.text();
      if (!res.ok && res.status !== 404) throw new InfraError('SEARCH_INFRA', `opensearch ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
      return (text ? JSON.parse(text) : {}) as T;
    });
  }

  /** Idempotent: create the index with mappings/settings only if absent. */
  async ensureIndex(logical: string, body: Record<string, unknown>): Promise<void> {
    const name = this.indexName(logical);
    const head = await this.request<{ status?: number }>('GET', `/${name}`);
    if ((head as any)?.status === 404 || (head as any)?.error) { await this.request('PUT', `/${name}`, body); }
  }
  /** Upsert one document by id (idempotent — safe to replay). */
  async indexDoc(logical: string, id: string, doc: Record<string, unknown>): Promise<void> {
    await this.request('PUT', `/${this.indexName(logical)}/_doc/${encodeURIComponent(id)}`, doc);
  }
  /** Remove a document by id (404 tolerated — already gone). */
  async deleteDoc(logical: string, id: string): Promise<void> {
    await this.request('DELETE', `/${this.indexName(logical)}/_doc/${encodeURIComponent(id)}`);
  }
  /** Batched bulk upsert/delete (the reindex backfill path). Bounded by the caller. */
  async bulk(logical: string, ops: BulkOp[]): Promise<void> {
    if (ops.length === 0) return;
    const name = this.indexName(logical);
    const lines: string[] = [];
    for (const op of ops) {
      if (op.delete) { lines.push(JSON.stringify({ delete: { _index: name, _id: op.id } })); }
      else { lines.push(JSON.stringify({ index: { _index: name, _id: op.id } })); lines.push(JSON.stringify(op.doc ?? {})); }
    }
    // _bulk needs an NDJSON body + a trailing newline; send it directly (not JSON-encoded).
    await this.resilience.run(DEP, async () => {
      const headers: Record<string, string> = { 'content-type': 'application/x-ndjson' };
      if (this.authHeader) headers.authorization = this.authHeader;
      const res = await fetch(`${this.base}/_bulk`, { method: 'POST', headers, body: lines.join('\n') + '\n' });
      const text = await res.text();
      if (!res.ok) throw new InfraError('SEARCH_INFRA', `opensearch _bulk → ${res.status}: ${text.slice(0, 300)}`);
      const parsed = JSON.parse(text);
      if (parsed.errors) throw new InfraError('SEARCH_INFRA', `opensearch _bulk had item errors`);
    });
  }
  async search<T = any>(logical: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', `/${this.indexName(logical)}/_search`, body);
  }
  /** Make recently-indexed docs visible (tests/backfill only — never on the hot path). */
  async refresh(logical: string): Promise<void> { await this.request('POST', `/${this.indexName(logical)}/_refresh`); }
}
