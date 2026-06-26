// modules/search/read-models/search-fallback.read-model.ts · the Postgres FALLBACK for unified search (Law 12).
// When OpenSearch is unconfigured or down, the unified endpoint degrades to a parameterised replica query per
// entity type — still CQRS (replica, never the write primary) and still tenant-isolated by RLS + an explicit
// tenant_id predicate. Free text is a bounded `title ILIKE '%' || $q || '%'` (the param is a value, never
// interpolated SQL — no injection; ReDoS-safe). Keyset on (created_at DESC, id DESC); results are mapped to the
// type-agnostic RawHit the ranker consumes. Coverage is the entity types that have a queryable source table
// (listings, products today) — never fabricated.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { RawHit, SearchType } from '../domain/search.rank';

@Injectable()
export class SearchFallbackReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Fetch up to `limit` hits of one type matching `text`, tenant-scoped. Cursor is the per-type keyset token. */
  async fetch(tenantId: string, type: SearchType, text: string, limit: number, cursor?: string): Promise<{ hits: RawHit[]; nextCursor?: string }> {
    if (type === 'listings') return this.fetchListings(tenantId, text, limit, cursor);
    if (type === 'products') return this.fetchProducts(tenantId, text, limit, cursor);
    return { hits: [] };
  }

  private decode(c?: string): { ts: string; id: string } | undefined {
    if (!c) return undefined;
    try { const o = JSON.parse(Buffer.from(c, 'base64url').toString('utf8')); return (o?.ts && o?.id) ? { ts: o.ts, id: o.id } : undefined; } catch { return undefined; }
  }
  private encode(ts: string, id: string): string { return Buffer.from(JSON.stringify({ ts, id })).toString('base64url'); }

  private async fetchListings(tenantId: string, text: string, limit: number, cursor?: string): Promise<{ hits: RawHit[]; nextCursor?: string }> {
    const params: unknown[] = [tenantId, text];
    const where = [`tenant_id = $1`, `status = 'published'`, `visibility IN ('public','cross_tenant')`, `deleted_at IS NULL`, `title ILIKE '%' || $2 || '%'`];
    const cur = this.decode(cursor);
    if (cur) { params.push(cur.ts, cur.id); where.push(`(created_at < $3 OR (created_at = $3 AND id < $4))`); }
    const lim = Math.max(1, Math.min(limit, 50));
    const sql = `SELECT id, title, created_at FROM listings WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ${lim + 1}`;
    const r = await this.replica.forTenant(tenantId).query<any>(sql, params);
    return this.page(r.rows, lim, (row) => ({ type: 'listings', id: String(row.id), title: row.title ?? '', createdAt: this.iso(row.created_at) }));
  }

  private async fetchProducts(tenantId: string, text: string, limit: number, cursor?: string): Promise<{ hits: RawHit[]; nextCursor?: string }> {
    // platform-master (tenant_id NULL) + this tenant's own products; active, non-deleted; name match.
    const params: unknown[] = [tenantId, text];
    const where = [`(tenant_id = $1 OR tenant_id IS NULL)`, `is_active`, `deleted_at IS NULL`, `default_name ILIKE '%' || $2 || '%'`];
    const cur = this.decode(cursor);
    if (cur) { params.push(cur.ts, cur.id); where.push(`(created_at < $3 OR (created_at = $3 AND id < $4))`); }
    const lim = Math.max(1, Math.min(limit, 50));
    const sql = `SELECT id, default_name, created_at FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ${lim + 1}`;
    const r = await this.replica.forTenant(tenantId).query<any>(sql, params);
    return this.page(r.rows, lim, (row) => ({ type: 'products', id: String(row.id), title: row.default_name ?? '', createdAt: this.iso(row.created_at) }));
  }

  private page(rows: any[], lim: number, map: (row: any) => RawHit): { hits: RawHit[]; nextCursor?: string } {
    const hasMore = rows.length > lim;
    const slice = hasMore ? rows.slice(0, lim) : rows;
    const hits = slice.map(map);
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? this.encode(this.iso(last.created_at), String(last.id)) : undefined;
    return { hits, nextCursor };
  }
  private iso(v: any): string { return v instanceof Date ? v.toISOString() : String(v); }
}
