// modules/listings/__tests__/listing.service.spec.ts
// Unit tests for the application service orchestration: idempotency wrapping, quota
// enforcement, single-transaction persistence, and outbox-in-tx event flushing.
// All infra is mocked — this proves the WIRING, not the DB.
import { ListingService } from '../services/listing.service';

function makeTx() {
  return { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }), tenantId: 't1', userId: 'u1' };
}

describe('ListingService.create', () => {
  let uow: any, outbox: any, quota: any, idem: any, cache: any, metrics: any, repo: any, priceHist: any, attrs: any;
  let svc: ListingService;
  const dto: any = {
    productId: '11111111-1111-1111-1111-111111111111', categoryId: '22222222-2222-2222-2222-222222222222',
    title: 'Organic Wheat', quantityTotal: 50, minOrderQty: 1, unitCode: 'quintal',
    priceMinor: '1440000', currencyCode: 'INR', organicClaim: 'certified', saleType: 'direct',
    visibility: 'public', attributes: [],
  };

  beforeEach(() => {
    const tx = makeTx();
    uow = { run: jest.fn((_t: string, fn: any) => fn(tx)) };
    outbox = { write: jest.fn().mockResolvedValue(undefined) };
    quota = { assertWithinLimit: jest.fn().mockResolvedValue(undefined), increment: jest.fn().mockResolvedValue(undefined) };
    // idempotency: pass-through (first call executes the work)
    idem = { remember: jest.fn((_k: string, _u: string, _o: string, fn: any) => fn()) };
    cache = { del: jest.fn(), wrap: jest.fn(), get: jest.fn(), set: jest.fn() };
    metrics = { inc: jest.fn(), observe: jest.fn(), timing: jest.fn() };
    repo = { insert: jest.fn().mockResolvedValue(undefined) };
    priceHist = { append: jest.fn() };
    attrs = { upsertMany: jest.fn().mockResolvedValue(undefined) };
    svc = new ListingService(uow, outbox, quota, idem, cache, metrics, repo, priceHist, attrs);
  });

  it('enforces quota before creating', async () => {
    await svc.create('t1', 'u1', 'idem-1', dto);
    expect(quota.assertWithinLimit).toHaveBeenCalledWith('t1', 'max_listings_month');
  });

  it('persists the listing and flushes the created event to the outbox in the same tx', async () => {
    await svc.create('t1', 'u1', 'idem-1', dto);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(quota.increment).toHaveBeenCalledTimes(1);
    const eventTypes = outbox.write.mock.calls.map((c: any[]) => c[1].eventType);
    expect(eventTypes).toContain('listing.created');
  });

  it('wraps the whole use-case in idempotency.remember', async () => {
    await svc.create('t1', 'u1', 'idem-key-xyz', dto);
    expect(idem.remember).toHaveBeenCalledWith('idem-key-xyz', 'u1', 'listings.create', expect.any(Function));
  });

  it('returns a generated id', async () => {
    const { id } = await svc.create('t1', 'u1', 'idem-1', dto);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
