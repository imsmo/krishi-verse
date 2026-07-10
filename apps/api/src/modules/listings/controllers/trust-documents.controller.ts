// modules/listings/controllers/trust-documents.controller.ts · KV-BL-031 (screen 112 trust badge).
// LINKS an already-uploaded, clean media asset (kind='document') to a listing. Owner-only (server-enforced).
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../core/auth/permissions.guard';
import { FeatureFlagGuard } from '../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../core/http/zod.pipe';
import { CurrentContext } from '../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../core/tenancy-context/request-context';
import { ListingTrustDocumentService } from '../services/listing-trust-document.service';
import { AttachTrustDocumentDto, AttachTrustDocumentSchema } from '../dto/attach-trust-document.dto';
import { ListingPermissions, canModerate } from '../listings.policies';

@Controller({ path: 'listings/:id/trust-documents', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
export class TrustDocumentsController {
  constructor(private readonly service: ListingTrustDocumentService) {}

  /** Attach a lab report / certification / other document (already uploaded + AV-clean) to raise the listing's
   *  trust badge. Owner-only. verifiedAt always returns null here — verification is a separate ops flow. */
  @Post()
  @RequirePermissions(ListingPermissions.Update)
  async attach(
    @CurrentContext() ctx: RequestContext, @Param('id') id: string,
    @ZodBody(AttachTrustDocumentSchema) dto: AttachTrustDocumentDto,
  ) {
    const row = await this.service.attach(ctx.tenantId, { userId: ctx.userId, canModerate: canModerate(ctx) }, id, dto);
    return { data: { id: row.id, listingId: row.listingId, mediaAssetId: row.mediaAssetId, docType: row.docType, verifiedAt: null } };
  }

  /** List the listing's trust documents. Owner-only for now (no public trust-badge read surface in this pass). */
  @Get()
  async list(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    const rows = await this.service.list(ctx.tenantId, { userId: ctx.userId, canModerate: canModerate(ctx) }, id);
    return { data: rows.map((r) => ({ id: r.id, listingId: r.listingId, mediaAssetId: r.mediaAssetId, docType: r.docType, verifiedAt: r.verifiedAt })) };
  }
}
