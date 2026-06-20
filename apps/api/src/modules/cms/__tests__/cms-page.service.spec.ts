// modules/cms/__tests__/cms-page.service.spec.ts · service unit tests with fakes.
// Pins: create mints next version for a slug; authoring requires cms.manage (throws); publish archives the
// slug's prior published version (single-live invariant) + audits; getBySlug serves the live page.
import { CmsPageService } from '../services/cms-page.service';
import { CmsPage } from '../domain/cms-page.entity';
import { CmsForbiddenError, PageNotFoundError } from '../domain/cms.errors';

const draft = (over: Partial<any> = {}) => CmsPage.rehydrate({ id: 'p1', tenantId: 't1', slug: 'privacy-policy', pageKind: 'policy', defaultTitle: 'Privacy', body: 'b', version: 2, status: 'draft', publishedAt: null, ...over });

function harness(opts: { page?: CmsPage | null; maxVersion?: number; prior?: CmsPage[] } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const audit = { write: jest.fn() };
  const repo = { insert: jest.fn(), getForUpdate: jest.fn(async () => opts.page ?? null), getById: jest.fn(), maxVersion: jest.fn(async () => opts.maxVersion ?? 0), publishedForUpdate: jest.fn(async () => opts.prior ?? []), update: jest.fn(), publishedBySlug: jest.fn(async () => opts.page ?? null), listFor: jest.fn() };
  const svc = new CmsPageService(uow as any, outbox as any, metrics as any, audit as any, repo as any);
  return { svc, repo, audit };
}
const admin = { userId: 'a1', canManage: true };
const user = { userId: 'u1', canManage: false };

describe('create', () => {
  it('mints the next version for an existing slug', async () => {
    const h = harness({ maxVersion: 3 });
    const out = await h.svc.create('t1', admin, { slug: 'privacy-policy', pageKind: 'policy', defaultTitle: 'P', body: 'b' } as any);
    expect(out.version).toBe(4); expect(out.status).toBe('draft'); expect(h.repo.insert).toHaveBeenCalledTimes(1);
  });
  it('throws without cms.manage', async () => {
    const h = harness();
    await expect(h.svc.create('t1', user, { slug: 'x', pageKind: 'static', defaultTitle: 'P', body: 'b' } as any)).rejects.toBeInstanceOf(CmsForbiddenError);
  });
});

describe('publish', () => {
  it('archives the slug\'s prior published version then publishes this one + audits', async () => {
    const prior = draft({ id: 'p0', version: 1, status: 'published', publishedAt: new Date() });
    const h = harness({ page: draft(), prior: [prior] });
    const out = await h.svc.publish('t1', admin, 'p1', '1.1.1.1');
    expect(out.status).toBe('published');
    expect(prior.status).toBe('archived');                 // prior retired
    expect(h.repo.update).toHaveBeenCalledTimes(2);        // prior + this
    expect(h.audit.write).toHaveBeenCalledTimes(1);
  });
  it('404 when missing', async () => {
    const h = harness({ page: null });
    await expect(h.svc.publish('t1', admin, 'nope', null)).rejects.toBeInstanceOf(PageNotFoundError);
  });
});

describe('getBySlug (public)', () => {
  it('serves the live page', async () => {
    const h = harness({ page: draft({ status: 'published' }) });
    expect((await h.svc.getBySlug('t1', 'privacy-policy')).slug).toBe('privacy-policy');
  });
});
