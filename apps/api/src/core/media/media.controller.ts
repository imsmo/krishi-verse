// core/media/media.controller.ts · presigned upload/download for the authenticated caller.
// validate → authorize → delegate. Upload needs only authentication (a user uploads their own
// media); download is owner/moderator-or-platform scoped (404 to others) and only when clean.
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentContext } from '../tenancy-context/current-context.decorator';
import { RequestContext } from '../tenancy-context/request-context';
import { ZodBody } from '../http/zod.pipe';
import { MediaService } from './media-links.service';
import { RequestUploadSchema, RequestUploadDto, ConfirmUploadSchema, ConfirmUploadDto } from './media.dto';

function canModerateMedia(ctx: RequestContext): boolean { return ctx.permissions.has('listing.moderate') || ctx.permissions.has('*'); }

@Controller({ path: 'media', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateMedia(ctx) }; }

  @Post('upload-url')
  upload(@CurrentContext() ctx: RequestContext, @ZodBody(RequestUploadSchema) dto: RequestUploadDto) {
    return this.media.requestUpload(ctx.tenantId, ctx.userId, dto).then((data) => ({ data }));
  }

  @Post(':id/confirm')
  confirm(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(ConfirmUploadSchema) dto: ConfirmUploadDto) {
    return this.media.confirmUpload(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data }));
  }

  @Get(':id/download-url')
  download(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.media.getDownloadUrl(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data }));
  }
}
