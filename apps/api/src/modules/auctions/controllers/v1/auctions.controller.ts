// modules/auctions/controllers/v1/auctions.controller.ts · auction lifecycle (validate→authorize→
// delegate). Create needs auction.create; approve/cancel are seller-or-moderator (enforced in the
// service via the listing's seller). List/get are public-within-tenant. Gated by the `auctions` flag.
import { Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { AuctionService } from '../../services/auction.service';
import { CreateAuctionSchema, CreateAuctionDto } from '../../dto/create-auction.dto';
import { AuctionPermissions, canModerateAuction } from '../../policies/auctions.policies';

const ipOf = (req: Request) => req.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'auctions', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateAuction(ctx) }; }

  @Post() @RequirePermissions(AuctionPermissions.Create)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateAuctionSchema) dto: CreateAuctionDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.auctions.create(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @Query('status') status?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.auctions.list(ctx.tenantId, { status, cursor: decodeCursor(cursor), limit: lim }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.auctions.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Post(':id/approve')
  approve(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.auctions.approve(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then(() => ({ data: { ok: true } })); }

  @Post(':id/cancel')
  cancel(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.auctions.cancel(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then(() => ({ data: { ok: true } })); }
}
