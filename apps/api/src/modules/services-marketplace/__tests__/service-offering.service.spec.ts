// modules/services-marketplace/__tests__/service-offering.service.spec.ts · ServiceOfferingService unit tests.
// Pins: create enforces quota (Law: QuotaService) + records an outbox event in-tx; authz THROWS without
// service.offer (Law 6); a provider can only mutate their OWN offering (anti-IDOR, 403 not silent no-op).
import { ServiceOfferingService } from '../services/service-offering.service';
import { ServiceOffering } from '../domain/service-offering.entity';
import { ServicesForbiddenError } from '../domain/services-marketplace.errors';

function harness(opts: { offering?: ServiceOffering } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const quota = { assertWithinLimit: jest.fn(async () => undefined), increment: jest.fn() };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const repo = { insert: jest.fn(), getForUpdate: jest.fn(async () => opts.offering ?? null), getById: jest.fn(), update: jest.fn(), listFor: jest.fn() };
  const s = new ServiceOfferingService(uow as any, outbox as any, idem as any, quota as any, metrics as any, repo as any);
  return { s, quota, outbox, repo };
}
const provider = { userId: 'prov', canOffer: true, canBook: false, isAdmin: false };
const dto = { categoryId: 'c1', defaultTitle: 'Tractor ploughing', pricingModel: 'per_visit', priceMinor: '50000' } as any;

describe('ServiceOfferingService.create', () => {
  it('asserts quota then inserts the draft in-tx', async () => {
    const { s, quota, repo } = harness();
    const out = await s.create('t1', provider, 'idem-1', dto);
    expect(quota.assertWithinLimit).toHaveBeenCalledTimes(1);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(quota.increment).toHaveBeenCalledTimes(1);
    expect(out.status).toBe('draft');                       // a draft emits no event until published
  });
  it('throws (not silently skips) when the caller lacks service.offer', async () => {
    const { s, quota } = harness();
    const noPerm = { userId: 'x', canOffer: false, canBook: true, isAdmin: false };
    await expect(s.create('t1', noPerm, 'idem-2', dto)).rejects.toBeInstanceOf(ServicesForbiddenError);
    expect(quota.assertWithinLimit).not.toHaveBeenCalled();
  });
});

describe('ServiceOfferingService.setStatus (provider-only)', () => {
  it('forbids a non-owner from publishing someone else’s offering', async () => {
    const owned = ServiceOffering.rehydrate({ id: 'o1', tenantId: 't1', providerUserId: 'prov', categoryId: 'c1', defaultTitle: 'X', description: null,
      pricingModel: 'per_visit', priceMinor: 50000n, currencyCode: 'INR', capacityPerSlot: null, serviceRadiusKm: null, addressId: null, status: 'draft' });
    const { s } = harness({ offering: owned });
    const intruder = { userId: 'someoneElse', canOffer: true, canBook: false, isAdmin: false };
    await expect(s.setStatus('t1', intruder, 'o1', 'publish')).rejects.toBeInstanceOf(ServicesForbiddenError);
  });
  it('lets the owner publish their own offering', async () => {
    const owned = ServiceOffering.rehydrate({ id: 'o1', tenantId: 't1', providerUserId: 'prov', categoryId: 'c1', defaultTitle: 'X', description: null,
      pricingModel: 'per_visit', priceMinor: 50000n, currencyCode: 'INR', capacityPerSlot: null, serviceRadiusKm: null, addressId: null, status: 'draft' });
    const { s, repo } = harness({ offering: owned });
    const out = await s.setStatus('t1', provider, 'o1', 'publish');
    expect(out.status).toBe('published'); expect(repo.update).toHaveBeenCalledTimes(1);
  });
});
