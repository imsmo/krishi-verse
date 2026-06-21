// apps/stream-processor/src/downstream/opensearch.writer.ts · thin OpenSearch REST writer for the search-indexer
// consumer. Self-contained over global fetch (no SDK) — mirrors apps/api core/search's transport contract:
// idempotent upsert/delete BY ID (so a redelivered event is a safe no-op) into a prefixed index. A 4xx that
// isn't 404 is a permanent (bad-doc) error → the consumer DLQs it; 5xx/network → throw (transient) so the
// runtime retries. When no OPENSEARCH_URL is configured the writer is disabled (degrade: search falls back to
// the replica path in apps/api). NEVER indexes PII it wasn't given; the projection decides the doc shape.
import { PoisonMessageError } from '../processing/retry-policy';

export class OpenSearchWriter {
  private readonly base: string | null;
  private readonly auth: string | null;
  constructor(url: string | null, basicAuth: string | null, private readonly prefix: string, private readonly timeoutMs = 4000) {
    this.base = url ? url.replace(/\/+$/, '') : null;
    this.auth = basicAuth ? `Basic ${Buffer.from(basicAuth).toString('base64')}` : null;
  }

  get enabled(): boolean { return this.base !== null; }
  index(logical: string): string { return `${this.prefix}_${logical}`; }

  async upsert(logical: string, id: string, doc: Record<string, unknown>): Promise<void> {
    await this.req('PUT', `/${this.index(logical)}/_doc/${encodeURIComponent(id)}`, doc);
  }
  async remove(logical: string, id: string): Promise<void> {
    await this.req('DELETE', `/${this.index(logical)}/_doc/${encodeURIComponent(id)}`, undefined, /*allow404*/ true);
  }

  private async req(method: string, path: string, body?: unknown, allow404 = false): Promise<void> {
    if (!this.base) return;                                  // disabled → no-op (degrade)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.auth) headers.authorization = this.auth;
      const res = await fetch(`${this.base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
      if (res.ok) return;
      if (allow404 && res.status === 404) return;            // delete of an absent doc is fine (idempotent)
      if (res.status >= 400 && res.status < 500) throw new PoisonMessageError('OPENSEARCH_REJECTED', `opensearch ${res.status}`);
      throw new Error(`opensearch ${res.status}`);           // 5xx → transient → retry
    } finally {
      clearTimeout(timer);
    }
  }
}
