// modules/listings/__tests__/listing-trust-document.service.spec.ts · KV-BL-031 (screen 112 trust badge).
// Unit tests with fakes: owner-only enforcement, media-validity gate, and the link-table insert + outbox event.
import { ListingTrustDocumentService } from '../services/listing-trust-document.service';
import { ForbiddenError } from '../../../shared/errors/app-error';
import { TrustDocumentMediaInvalidError } from '../domain/listing.errors';

function build(opts: { sellerUserId?: string; mediaOk?: boolean; existingRow?: any } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn().mockResolvedValue(undefined) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const listings = {
    getForUpdate: jest.fn().mockResolvedValue({ sellerUserId: opts.sellerUserId ?? 'owner-A' }),
    findById: jest.fn().mockResolvedValue({ toProps: () => ({ sellerUserId: opts.sellerUserId ?? 'owner-A' }) }),
  };
  const repo = {
    mediaAttachable: jest.fn().mockResolvedValue(opts.mediaOk ?? true),
    insert: jest.fn().mockResolvedValue(undefined),
    getByListingAndMedia: jest.fn().mockResolvedValue(opts.existingRow ?? null),
    listForListing: jest.fn().mockResolvedValue([]),
  };
  const svc = new ListingTrustDocumentService(uow as any, outbox as any, metrics as any, audit as any, listings as any, repo as any);
  return { svc, uow, outbox, audit, listings, repo };
}

const dto = { mediaAssetId: '33333333-3333-3333-3333-333333333333', docType: 'lab_report' as const };

describe('ListingTrustDocumentService.attach', () => {
  it('links the media to the listing and flushes listing.trust_document_attached to the outbox', async () => {
    const { svc, repo, outbox } = build({
      existingRow: { id: 'D1', listingId: 'L1', mediaAssetId: dto.mediaAssetId, docType: 'lab_report', verifiedAt: null, uploadedBy: 'owner-A', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    const row = await svc.attach('t1', { userId: 'owner-A', canModerate: false }, 'L1', dto);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(row.verifiedAt).toBeNull(); // ops verification flow is out of scope — always null here
    const eventTypes = outbox.write.mock.calls.map((c: any[]) => c[1].eventType);
    expect(eventTypes).toContain('listing.trust_document_attached');
  });

  it('rejects a media asset that is not clean/owned/a document (TrustDocumentMediaInvalidError)', async () => {
    const { svc, repo } = build({ mediaOk: false });
    await expect(svc.attach('t1', { userId: 'owner-A', canModerate: false }, 'L1', dto)).rejects.toBeInstanceOf(TrustDocumentMediaInvalidError);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('a non-owner WITHOUT moderate permission is rejected with ForbiddenError (owner-only)', async () => {
    const { svc, repo } = build({ sellerUserId: 'owner-A' });
    await expect(svc.attach('t1', { userId: 'intruder-B', canModerate: false }, 'L1', dto)).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('a moderator MAY attach a document to a listing they do not own, and it is audited', async () => {
    const { svc, repo, audit } = build({ sellerUserId: 'owner-A' });
    await svc.attach('t1', { userId: 'admin-Z', canModerate: true }, 'L1', dto);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalled();
  });

  it('a repeat attach of the SAME (listing, media) is idempotent — no error, returns the persisted row', async () => {
    const existing = { id: 'D1', listingId: 'L1', mediaAssetId: dto.mediaAssetId, docType: 'lab_report', verifiedAt: null, uploadedBy: 'owner-A', createdAt: '2026-01-01T00:00:00.000Z' };
    const { svc, repo } = build({ existingRow: existing });
    const first = await svc.attach('t1', { userId: 'owner-A', canModerate: false }, 'L1', dto);
    const second = await svc.attach('t1', { userId: 'owner-A', canModerate: false }, 'L1', dto);
    expect(first).toEqual(second);
    expect(repo.insert).toHaveBeenCalledTimes(2); // ON CONFLICT DO NOTHING makes the 2nd insert a DB-level no-op
  });
});

describe('ListingTrustDocumentService.list', () => {
  it('returns [] (not an error) for a non-owner, non-moderator — anti-enumeration', async () => {
    const { svc } = build({ sellerUserId: 'owner-A' });
    const rows = await svc.list('t1', { userId: 'stranger', canModerate: false }, 'L1');
    expect(rows).toEqual([]);
  });
});
