// core/search/__tests__/search-index.spec.ts · OpenSearch index-builders unit tests (pure/mocked).
// Pins the security-critical invariant (every query carries the tenant filter — no cross-tenant leak), the
// keyset cursor (search_after, never OFFSET), the projectors (tenant sentinel for platform rows; money stays a
// string), isIndexable, the builder's upsert-or-drop sync, the flag-gated handler, and event→index routing.
import { OpenSearchSearchClient, PLATFORM_TENANT } from '../opensearch.client';
import { LISTINGS_INDEX } from '../indices/listings.index';
import { PRODUCTS_INDEX } from '../indices/products.index';
import { indicesForEvent } from '../indices/index-registry';
import { IndexBuilderService } from '../index-builder.service';
import { SearchIndexHandler } from '../handlers/search-index.handler';

function fakeTransport(hits: any[] = []) {
  const calls: any = { search: [], index: [], delete: [], ensure: [] };
  const t = {
    enabled: true,
    indexName: (l: string) => `kv_${l}`,
    search: jest.fn(async (_l: string, body: any) => { calls.search.push(body); return { hits: { hits } }; }),
    indexDoc: jest.fn(async (l: string, id: string, doc: any) => { calls.index.push({ l, id, doc }); }),
    deleteDoc: jest.fn(async (l: string, id: string) => { calls.delete.push({ l, id }); }),
    ensureIndex: jest.fn(async (l: string) => { calls.ensure.push(l); }),
    bulk: jest.fn(),
  };
  return { t, calls };
}
const metrics = { inc: jest.fn(), observe: jest.fn() } as any;

describe('OpenSearchSearchClient — tenant isolation + keyset', () => {
  it('ALWAYS injects a tenant filter (caller + platform sentinel) and never OFFSET', async () => {
    const { t, calls } = fakeTransport();
    const client = new OpenSearchSearchClient(t as any);
    await client.query('listings', { tenantId: 'tenantA', filter: [{ term: { sale_type: 'fixed' } }], sort: 'created_at:desc', limit: 20, text: 'tomato', textFields: ['title'] });
    const body = calls.search[0];
    expect(body.query.bool.filter[0]).toEqual({ terms: { tenant_id: ['tenantA', PLATFORM_TENANT] } });
    expect(body.query.bool.filter).toContainEqual({ term: { sale_type: 'fixed' } });
    expect(body.query.bool.must[0].multi_match).toMatchObject({ query: 'tomato', fields: ['title'] });
    expect(body.size).toBe(20);
    expect(body.sort[body.sort.length - 1]).toEqual({ _id: 'asc' });   // keyset tiebreaker
    expect(JSON.stringify(body)).not.toMatch(/"from"|offset/i);
  });
  it('rejects an untenanted query (fail closed)', async () => {
    const { t } = fakeTransport();
    await expect(new OpenSearchSearchClient(t as any).query('listings', { tenantId: '', filter: [], sort: 'created_at', limit: 10 })).rejects.toThrow(/TENANT/);
  });
  it('emits a search_after cursor and consumes one', async () => {
    const hit = { _id: 'l9', _source: { title: 'x' }, sort: ['2026-01-01T00:00:00Z', 'l9'] };
    const { t, calls } = fakeTransport([hit]);
    const client = new OpenSearchSearchClient(t as any);
    const page = await client.query('listings', { tenantId: 'A', filter: [], sort: 'created_at:desc', limit: 1 });
    expect(page.items[0]).toMatchObject({ id: 'l9', title: 'x' });
    expect(page.nextCursor).toBeTruthy();
    await client.query('listings', { tenantId: 'A', filter: [], sort: 'created_at:desc', limit: 1, cursor: page.nextCursor });
    expect(calls.search[1].search_after).toEqual(['2026-01-01T00:00:00Z', 'l9']);
  });
});

describe('projectors + isIndexable', () => {
  it('listing: money stays a string; only published+visible is indexable', () => {
    const row = { id: 'l1', tenant_id: 't1', title: 'Tomatoes', price_minor: '1234567890123', currency_code: 'INR', unit_code: 'kg', quantity_available: '5', organic_claim: 'certified', sale_type: 'fixed', status: 'published', visibility: 'public', created_at: new Date('2026-01-01') };
    const { id, doc } = LISTINGS_INDEX.project(row);
    expect(id).toBe('l1');
    expect(doc.price_minor).toBe('1234567890123'); expect(typeof doc.price_minor).toBe('string');
    expect(doc.organic_claim).toBe(true); expect(doc.tenant_id).toBe('t1');
    expect(LISTINGS_INDEX.isIndexable(row)).toBe(true);
    expect(LISTINGS_INDEX.isIndexable({ ...row, status: 'archived' })).toBe(false);
    expect(LISTINGS_INDEX.isIndexable({ ...row, deleted_at: new Date() })).toBe(false);
  });
  it('product: platform (tenant NULL) maps to the platform sentinel', () => {
    const { doc } = PRODUCTS_INDEX.project({ id: 'p1', tenant_id: null, default_name: 'Urea', category_id: 'c1', is_active: true });
    expect(doc.tenant_id).toBe(PLATFORM_TENANT); expect(doc.is_platform).toBe(true);
    expect(PRODUCTS_INDEX.isIndexable({ is_active: true, deleted_at: null })).toBe(true);
    expect(PRODUCTS_INDEX.isIndexable({ is_active: false, deleted_at: null })).toBe(false);
  });
});

describe('IndexBuilderService.syncById', () => {
  const def = LISTINGS_INDEX;
  it('upserts an indexable row', async () => {
    const { t, calls } = fakeTransport();
    const reader = { query: jest.fn(async () => ({ rows: [{ id: 'l1', tenant_id: 't1', title: 'x', price_minor: '100', currency_code: 'INR', unit_code: 'kg', quantity_available: 1, sale_type: 'fixed', status: 'published', visibility: 'public', created_at: new Date() }] })) };
    const out = await new IndexBuilderService(t as any, metrics).syncById(reader as any, def, 'l1');
    expect(out).toBe('upserted'); expect(calls.index[0].id).toBe('l1');
  });
  it('removes when the row is gone or not indexable', async () => {
    const { t, calls } = fakeTransport();
    const builder = new IndexBuilderService(t as any, metrics);
    expect(await builder.syncById({ query: jest.fn(async () => ({ rows: [] })) } as any, def, 'gone')).toBe('removed');
    expect(await builder.syncById({ query: jest.fn(async () => ({ rows: [{ id: 'l2', status: 'archived', visibility: 'public', deleted_at: null }] })) } as any, def, 'l2')).toBe('removed');
    expect(calls.delete.length).toBe(2);
  });
});

describe('SearchIndexHandler (flag-gated)', () => {
  const reader = { query: jest.fn(async () => ({ rows: [] })) } as any;
  const tx = reader;
  const baseEvent = { id: '1', tenantId: 't1', aggregateType: 'listing', aggregateId: 'l1', eventType: 'listing.published', payload: {} };
  it('no-ops when the flag is OFF', async () => {
    const builder = { enabled: true, syncById: jest.fn() } as any;
    const flags = { isEnabled: jest.fn(async () => false) } as any;
    await new SearchIndexHandler('listing.published', builder, flags).handle(baseEvent as any, tx);
    expect(builder.syncById).not.toHaveBeenCalled();
  });
  it('no-ops when no engine is configured', async () => {
    const builder = { enabled: false, syncById: jest.fn() } as any;
    const flags = { isEnabled: jest.fn(async () => true) } as any;
    await new SearchIndexHandler('listing.published', builder, flags).handle(baseEvent as any, tx);
    expect(builder.syncById).not.toHaveBeenCalled();
  });
  it('syncs the routed index when enabled + flag ON', async () => {
    const builder = { enabled: true, syncById: jest.fn(async () => 'upserted') } as any;
    const flags = { isEnabled: jest.fn(async () => true) } as any;
    await new SearchIndexHandler('listing.published', builder, flags).handle(baseEvent as any, tx);
    expect(builder.syncById).toHaveBeenCalledWith(tx, LISTINGS_INDEX, 'l1');
  });
});

describe('event routing', () => {
  it('routes catalogue + listing events to their indices', () => {
    expect(indicesForEvent('catalogue.product_created')).toContain(PRODUCTS_INDEX);
    expect(indicesForEvent('listing.published')).toContain(LISTINGS_INDEX);
    expect(indicesForEvent('nonexistent.event')).toEqual([]);
  });
});
