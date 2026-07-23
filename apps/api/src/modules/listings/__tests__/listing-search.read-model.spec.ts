// modules/listings/__tests__/listing-search.read-model.spec.ts
// Unit tests for ListingSearchReadModel's WHERE-clause construction (mocked replica — proves the SQL shape, not a
// real DB). Covers the "my listings" owner-view addition (KV device-testing fix): a public search must stay
// scoped to published+public/cross_tenant rows, while an owner-view search (opts.ownerUserId) must see ALL of
// their own rows (drafts/paused/rejected/etc — the whole point of a seller managing their own catalogue) and
// must NEVER leak another seller's rows even when both filters could theoretically combine.
import { ListingSearchReadModel } from '../read-models/listing-search.read-model';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OWNER = '22222222-2222-2222-2222-222222222222';

function build(rows: unknown[] = []) {
  const query = jest.fn().mockResolvedValue({ rows });
  const executor = { query };
  const replica: any = { forTenant: jest.fn().mockReturnValue(executor) };
  const metrics: any = { inc: jest.fn(), observe: jest.fn() };
  const rm = new ListingSearchReadModel(replica, metrics);
  return { rm, query };
}

describe('ListingSearchReadModel.query', () => {
  it('public search (no ownerUserId): filters to published + public/cross_tenant visibility', async () => {
    const { rm, query } = build();
    await rm.query(TENANT, { limit: 20, sort: 'newest' } as any);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/status = 'published'/);
    expect(sql).toMatch(/visibility IN \('public','cross_tenant'\)/);
    expect(sql).not.toMatch(/seller_user_id = \$/);
    expect(params[0]).toBe(TENANT);
  });

  it('owner view (mine): filters by seller_user_id and drops the published/visibility restriction entirely', async () => {
    const { rm, query } = build();
    await rm.query(TENANT, { limit: 20, sort: 'newest' } as any, { ownerUserId: OWNER });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/seller_user_id = \$2/);
    expect(sql).not.toMatch(/status = 'published'/);
    expect(sql).not.toMatch(/visibility IN/);
    expect(sql).toMatch(/tenant_id = \$1/);       // tenant scoping never relaxes
    expect(sql).toMatch(/deleted_at IS NULL/);    // soft-deletes never resurface
    expect(params).toEqual(expect.arrayContaining([TENANT, OWNER]));
  });

  it('owner view still composes with other filters (e.g. categoryId)', async () => {
    const { rm, query } = build();
    await rm.query(TENANT, { limit: 20, sort: 'newest', categoryId: '33333333-3333-3333-3333-333333333333' } as any, { ownerUserId: OWNER });
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/seller_user_id = \$2/);
    expect(sql).toMatch(/category_id = \$3/);
  });

  // KV mobile-hardening fix: the SELECT must carry `status` through to the mapped ListingCard — the owner
  // view ("my listings") is the one place a row can be anything OTHER than 'published' (draft/paused/
  // sold_out/expired/…), and the mobile badge/filter logic (badgeFor/countByStatus in
  // apps/mobile/src/features/listings/my-listings.ts) reads `item.status` to tell them apart. Before this
  // fix the SELECT never named the column, so every owner-view row silently defaulted to the 'live' badge.
  it('selects + maps `status` onto the ListingCard (owner view sees its real lifecycle status)', async () => {
    const row = {
      id: 'l1', title: 'Wheat', price_minor: '500000', currency_code: 'INR', unit_code: 'quintal',
      quantity_available: '50', organic_claim: 'none', sale_type: 'direct', region_id: null,
      seller_user_id: OWNER, created_at: new Date().toISOString(), status: 'draft',
    };
    const { rm, query } = build([row]);
    const res = await rm.query(TENANT, { limit: 20, sort: 'newest' } as any, { ownerUserId: OWNER });
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/\bstatus\b/);
    expect(res.items[0].status).toBe('draft');
  });
});
