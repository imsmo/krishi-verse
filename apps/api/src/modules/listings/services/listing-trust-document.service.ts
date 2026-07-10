// modules/listings/services/listing-trust-document.service.ts · KV-BL-031 (screen 112 trust badge).
// LINK an already-uploaded, clean, uploader-owned media_assets row (kind='document') to a listing. The raw file
// never touches this service — only a media REF verified clean before linking (mirrors
// schemes/services/scheme-document.service.ts's pattern exactly). Owner-only (server-enforced ownership, moderator
// override allowed + audited). verifiedAt always starts (and, in this pass, stays) null — verification is a
// separate ops flow, explicitly out of scope here. One ACID tx (UoW); outbox event in the SAME tx (Law 4).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ForbiddenError } from '../../../shared/errors/app-error';
import { ListingRepository } from '../repositories/listing.repository';
import { ListingTrustDocumentRepository, ListingTrustDocumentRow } from '../repositories/listing-trust-document.repository';
import { AttachTrustDocumentDto } from '../dto/attach-trust-document.dto';
import { TrustDocumentMediaInvalidError } from '../domain/listing.errors';
import { ListingActor } from './listing.service';

@Injectable()
export class ListingTrustDocumentService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly listings: ListingRepository,
    private readonly repo: ListingTrustDocumentRepository,
  ) {}

  async attach(tenantId: string, actor: ListingActor, listingId: string, dto: AttachTrustDocumentDto): Promise<ListingTrustDocumentRow> {
    return timed(this.metrics, 'listings.trust_document.attach', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        // getForUpdate throws ListingNotFoundError for a missing/deleted id, and assertCanMutate's ownership
        // check (403, not 404 — a write endpoint, matching publish/repost/changePrice's convention) enforces
        // owner-or-moderator only.
        const listing = await this.listings.getForUpdate(tx, tenantId, listingId);
        // Reuse the SAME ownership rule as every other listing write (owner OR moderator); kept inline (not
        // exported from ListingService, whose assertCanMutate is private) to avoid a wider refactor in this pass.
        if (!actor.canModerate && listing.sellerUserId !== actor.userId) {
          throw new ForbiddenError('You can only modify your own listings', { listingId });
        }
        if (!(await this.repo.mediaAttachable(tx, tenantId, dto.mediaAssetId, actor.userId))) throw new TrustDocumentMediaInvalidError();

        const id = uuidv7();
        await this.repo.insert(tx, { id, tenantId, listingId, mediaAssetId: dto.mediaAssetId, docType: dto.docType, uploadedBy: actor.userId });
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'listing.trust_document_attached', entityType: 'listing', entityId: listingId, newValue: { mediaAssetId: dto.mediaAssetId, docType: dto.docType }, ip: null });
        await this.outbox.write(tx, { tenantId, aggregateType: 'listing', aggregateId: listingId, eventType: 'listing.trust_document_attached', payload: { v: 1, listingId, mediaAssetId: dto.mediaAssetId, docType: dto.docType } });

        // Read back by (listing, media) — correct on BOTH the fresh insert and the ON CONFLICT no-op case (a
        // repeat attach of the same file is idempotent, unlike looking up by the just-generated id).
        const row = await this.repo.getByListingAndMedia(tx, tenantId, listingId, dto.mediaAssetId);
        return row ?? { id, listingId, mediaAssetId: dto.mediaAssetId, docType: dto.docType, verifiedAt: null, uploadedBy: actor.userId, createdAt: new Date().toISOString() };
      }, { userId: actor.userId }));
  }

  /** List a listing's trust documents. Owner-only for now (no public trust-badge surface built in this pass). */
  async list(tenantId: string, actor: ListingActor, listingId: string): Promise<ListingTrustDocumentRow[]> {
    const listing = await this.listings.findById(tenantId, listingId);
    if (!listing) return [];
    const p = listing.toProps();
    if (!actor.canModerate && p.sellerUserId !== actor.userId) return [];
    return this.repo.listForListing(tenantId, listingId);
  }
}
