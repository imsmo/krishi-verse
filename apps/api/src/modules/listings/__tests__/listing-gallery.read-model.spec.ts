// modules/listings/__tests__/listing-gallery.read-model.spec.ts
// Unit tests for ListingGalleryReadModel (mocked replica + object store — proves the authorization gate, not a
// real DB). KV-MF-14 (founder video review): before this pass, GET /listings/:id/media applied the PUBLIC gate
// (published + public/cross_tenant) unconditionally, so a farmer viewing their OWN listing-detail screen always
// saw photoCount=0 for a draft (not-yet-published) listing even with clean photos attached. These tests lock in
// the fix: a non-owner still only ever sees a published+public gallery, while the OWNER (or a moderator) sees
// their own clean media regardless of publish/visibility state — mirroring ListingService.getPublicById's
// existing owner/moderator bypass.
import { ListingGalleryReadModel } from '../read-models/listing-gallery.read-model';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OWNER = '22222222-2222-2222-2222-222222222222';
const LISTING = '33333333-3333-3333-3333-333333333333';

function build(listingRow: Record<string, unknown> | undefined, mediaRows: unknown[] = []) {
  const query = jest.fn()
    .mockResolvedValueOnce({ rows: listingRow ? [listingRow] : [] })   // 1st query: listings status/visibility/seller
    .mockResolvedValueOnce({ rows: mediaRows });                        // 2nd query: media_links JOIN media_assets (if reached)
  const executor = { query };
  const replica: any = { forTenant: jest.fn().mockReturnValue(executor) };
  const store: any = { presignDownload: jest.fn((key: string) => `https://cdn.example/${key}`) };
  const rm = new ListingGalleryReadModel(replica, store);
  return { rm, query };
}

const mediaRow = { media_id: 'm1', s3_key: 'tenants/t1/listing/m1.jpg', sort_order: 0 };

describe('ListingGalleryReadModel.forListing', () => {
  it('a stranger (no viewer) gets [] for a DRAFT listing — never leaks an unpublished seller\'s photos', async () => {
    const { rm, query } = build({ status: 'draft', visibility: 'public', seller_user_id: OWNER }, [mediaRow]);
    const res = await rm.forListing(TENANT, LISTING);
    expect(res.items).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1); // short-circuits before the media_links query
  });

  it('an anonymous/other viewer gets [] for a PUBLISHED but tenant-only listing', async () => {
    const { rm } = build({ status: 'published', visibility: 'tenant', seller_user_id: OWNER }, [mediaRow]);
    const res = await rm.forListing(TENANT, LISTING, { userId: 'stranger', canModerate: false });
    expect(res.items).toEqual([]);
  });

  it('anyone gets the gallery for a PUBLISHED + public listing', async () => {
    const { rm } = build({ status: 'published', visibility: 'public', seller_user_id: OWNER }, [mediaRow]);
    const res = await rm.forListing(TENANT, LISTING);
    expect(res.items).toEqual([{ mediaId: 'm1', url: 'https://cdn.example/tenants/t1/listing/m1.jpg', sortOrder: 0 }]);
  });

  // KV-MF-14 FIX: the owner must see their OWN clean photos on a draft/unpublished listing (the farmer's own
  // "Listing health" screen calls this same endpoint) — this is the regression the founder hit.
  it('the OWNER sees their own clean photos on a DRAFT listing (KV-MF-14 fix)', async () => {
    const { rm, query } = build({ status: 'draft', visibility: 'tenant', seller_user_id: OWNER }, [mediaRow]);
    const res = await rm.forListing(TENANT, LISTING, { userId: OWNER, canModerate: false });
    expect(res.items).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(2); // owner bypass reached the media_links query
  });

  it('a moderator sees the gallery on a DRAFT listing they do not own', async () => {
    const { rm } = build({ status: 'draft', visibility: 'tenant', seller_user_id: OWNER }, [mediaRow]);
    const res = await rm.forListing(TENANT, LISTING, { userId: 'admin-Z', canModerate: true });
    expect(res.items).toHaveLength(1);
  });

  it('a non-owner authenticated viewer still gets [] for a DRAFT listing (owner bypass never leaks to strangers)', async () => {
    const { rm } = build({ status: 'draft', visibility: 'tenant', seller_user_id: OWNER }, [mediaRow]);
    const res = await rm.forListing(TENANT, LISTING, { userId: 'intruder-B', canModerate: false });
    expect(res.items).toEqual([]);
  });

  it('returns [] when the listing does not exist', async () => {
    const { rm } = build(undefined);
    const res = await rm.forListing(TENANT, LISTING, { userId: OWNER, canModerate: false });
    expect(res.items).toEqual([]);
  });
});
