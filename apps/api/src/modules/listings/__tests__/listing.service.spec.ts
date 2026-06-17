// modules/listings/__tests__/listing.service.spec.ts
// Unit tests for the application service orchestration: idempotency wrapping,
// quota enforcement, single-transaction persistence, outbox-in-tx event flushing,
// and ENFORCED ownership/authorization. All infra is mocked — proves the WIRING.
import { ListingService } from '../services/listing.service';
import { ForbiddenError } from '../../../shared/errors/app-error';

function makeTx() {
  return { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }), tenantId: 't1', userId: 'u1' };
}

const dto: any = {
  productId: '11111111-1111-1111-1111-111111111111', categoryId: '22222222-2222-2222-2222-222222222222',
  title: 'Organic Wheat', quantityTotal: 50, minOrderQty: 1, unitCode: 'quintal',
  priceMinor: '1440000', currencyCode: 'INR', organicClaim: 'certified', saleType: 'direct',
  visibility: 'public', attributes: [], mediaIds: ['33333333-3333-3333-3333-333333333333'],
};

function build() {
  const tx = makeTx();
  const uow: any = { run: jest.fn((_t: string, fn: any) => fn(tx)) };
  const outbox: any = { write: jest.fn().mockResolvedValue(undefined) };
  const quota: any = { assertWithinLimit: jest.fn().mockResolvedValue(undefined), increment: jest.fn().mockResolvedValue(undefined) };
  const idem: any = { remember: jest.fn((_k: string, _u: string, _o: string, fn: any) => fn()) };
  const cache: any = { del: jest.fn(), wrap: jest.fn((_k: string, _t: number, load: any) => load()), get: jest.fn(), set: jest.fn() };
  const metrics: any = { inc: jest.fn(), observe: jest.fn() };
  const repo: any = { insert: jest.fn().mockResolvedValue(undefined), update: jest.fn().mockResolvedValue(undefined),
    getForUpdate: jest.fn(), findById: jest.fn() };
  const priceHist: any = { append: jest.fn() };
  const attrs: any = { upsertMany: jest.fn().mockResolvedValue(undefined) };
  const media: any = { attach: jest.fn().mockResolvedValue(undefined) };
  const audit: any = { write: jest.fn().mockResolvedValue(undefined) };
  const svc = new ListingService(uow, outbox, quota, idem, cache, metrics, repo, priceHist, attrs, media, audit);
  return { svc, uow, outbox, quota, idem, cache, metrics, repo, priceHist, attrs, media, audit, tx };
}

// A fake persisted listing for read-path tests (getById → repo.findById → toProps()).
const fakeListing = (over: Record<string, unknown> = {}) => ({
  toProps: () => ({ id: 'L1', status: 'draft', visibility: 'tenant', sellerUserId: 'owner-A', ...over }),
});

describe('ListingService.create', () => {
  it('enforces quota before creating', async () => {
    const { svc, quota } = build();
    await svc.create('t1', 'u1', 'idem-1', dto);
    expect(quota.assertWithinLimit).toHaveBeenCalledWith('t1', 'max_listings_month');
  });

  it('persists the listing, attaches media, and flushes created event to outbox in the same tx', async () => {
    const { svc, repo, quota, outbox, media } = build();
    await svc.create('t1', 'u1', 'idem-1', dto);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(quota.increment).toHaveBeenCalledTimes(1);
    expect(media.attach).toHaveBeenCalledWith(expect.anything(), 't1', expect.any(String), dto.mediaIds);
    const eventTypes = outbox.write.mock.calls.map((c: any[]) => c[1].eventType);
    expect(eventTypes).toContain('listing.created');
  });

  it('wraps the whole use-case in idempotency.remember', async () => {
    const { svc, idem } = build();
    await svc.create('t1', 'u1', 'idem-key-xyz', dto);
    expect(idem.remember).toHaveBeenCalledWith('idem-key-xyz', 'u1', 'listings.create', expect.any(Function));
  });

  it('returns a generated id', async () => {
    const { svc } = build();
    const { id } = await svc.create('t1', 'u1', 'idem-1', dto);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('ListingService authorization (security regression guard)', () => {
  const otherOwnersListing = {
    sellerUserId: 'owner-A', id: 'L9', version: 1,
    publish: jest.fn(), changePrice: jest.fn(),
    pullEvents: () => [], price: { minor: 100n },
  };

  it('publish() by a non-owner WITHOUT moderate permission throws ForbiddenError', async () => {
    const { svc, repo } = build();
    repo.getForUpdate.mockResolvedValue(otherOwnersListing);
    await expect(svc.publish('t1', { userId: 'intruder-B', canModerate: false }, 'L9'))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(otherOwnersListing.publish).not.toHaveBeenCalled();
  });

  it('publish() by an admin WITH moderate permission is allowed and is audited (override)', async () => {
    const { svc, repo, audit } = build();
    repo.getForUpdate.mockResolvedValue({ ...otherOwnersListing, publish: jest.fn(), pullEvents: () => [] });
    await expect(svc.publish('t1', { userId: 'admin-Z', canModerate: true }, 'L9')).resolves.toBeUndefined();
    expect(audit.write).toHaveBeenCalled(); // moderator acting on another's listing leaves a trail
  });
});

describe('ListingService.getPublicById (data-exposure regression guard)', () => {
  it('hides a DRAFT listing from an anonymous viewer (404, not the data)', async () => {
    const { svc, repo } = build();
    repo.findById.mockResolvedValue(fakeListing({ status: 'draft', visibility: 'public' }));
    await expect(svc.getPublicById('t1', 'L1', { userId: '', canModerate: false })).rejects.toBeTruthy();
  });
  it('hides a PUBLISHED-but-tenant-only listing from an anonymous viewer', async () => {
    const { svc, repo } = build();
    repo.findById.mockResolvedValue(fakeListing({ status: 'published', visibility: 'tenant' }));
    await expect(svc.getPublicById('t1', 'L1', { userId: '', canModerate: false })).rejects.toBeTruthy();
  });
  it('shows a PUBLISHED + public listing to anyone', async () => {
    const { svc, repo } = build();
    repo.findById.mockResolvedValue(fakeListing({ status: 'published', visibility: 'public' }));
    await expect(svc.getPublicById('t1', 'L1', { userId: '', canModerate: false })).resolves.toBeTruthy();
  });
  it('lets the OWNER preview their own draft', async () => {
    const { svc, repo } = build();
    repo.findById.mockResolvedValue(fakeListing({ status: 'draft', visibility: 'tenant', sellerUserId: 'owner-A' }));
    await expect(svc.getPublicById('t1', 'L1', { userId: 'owner-A', canModerate: false })).resolves.toBeTruthy();
  });
});
