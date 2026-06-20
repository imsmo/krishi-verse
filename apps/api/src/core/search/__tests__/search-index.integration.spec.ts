// core/search/__tests__/search-index.integration.spec.ts
// REAL proof against a live OpenSearch (the analog of cross-tenant RLS denial for the search path): index docs
// for tenant A, tenant B, and a platform doc, then query AS tenant A and assert the result contains A's doc +
// the platform doc and NEVER tenant B's. Runs only when OPENSEARCH_URL is set (CI search-service job); skipped
// otherwise. Uses a unique index name per run so it's isolated and self-cleaning.
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../../config/app-config';
import { PromMetrics } from '../../observability/metrics.prom';
import { ResilienceService } from '../../resilience/resilience.service';
import { OpenSearchTransport } from '../opensearch.transport';
import { OpenSearchSearchClient, PLATFORM_TENANT } from '../opensearch.client';

const URL = process.env.OPENSEARCH_URL;
const run = URL ? describe : describe.skip;

run('OpenSearch index-builders (integration — tenant isolation on a real cluster)', () => {
  const logical = `itest_listings_${randomUUID().slice(0, 8)}`;
  const tenantA = randomUUID(); const tenantB = randomUUID();
  let transport: OpenSearchTransport; let client: OpenSearchSearchClient;

  beforeAll(async () => {
    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://unused', JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', OPENSEARCH_URL: URL });
    transport = new OpenSearchTransport(config, new ResilienceService(new PromMetrics()));
    client = new OpenSearchSearchClient(transport);
    await transport.ensureIndex(logical, {
      mappings: { dynamic: 'strict', properties: { tenant_id: { type: 'keyword' }, title: { type: 'text' }, created_at: { type: 'date' } } },
    });
    const now = new Date().toISOString();
    await transport.indexDoc(logical, 'a1', { tenant_id: tenantA, title: 'tomato A', created_at: now });
    await transport.indexDoc(logical, 'b1', { tenant_id: tenantB, title: 'tomato B', created_at: now });
    await transport.indexDoc(logical, 'p1', { tenant_id: PLATFORM_TENANT, title: 'tomato platform', created_at: now });
    await transport.refresh(logical);
  }, 30000);

  it('tenant A sees only its own + platform docs — never tenant B', async () => {
    const page = await client.query(logical, { tenantId: tenantA, filter: [], sort: 'created_at:desc', limit: 50, text: 'tomato', textFields: ['title'] });
    const ids = page.items.map((i: any) => i.id).sort();
    expect(ids).toEqual(['a1', 'p1']);
    expect(ids).not.toContain('b1');
  });
});
