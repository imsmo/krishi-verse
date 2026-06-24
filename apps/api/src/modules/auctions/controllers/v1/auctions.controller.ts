// modules/auctions/controllers/v1/auctions.controller.ts · auction lifecycle (validate→authorize→
// delegate). Create/edit need auction.create; approve/cancel are seller-or-moderator (enforced in the
// service via the listing's seller). List/get/watch are public-within-tenant. Gated by `auctions`.
import { Controller, Delete, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { AuctionService } from '../../services/auction.service';
import { AuctionWatcherService } from '../../services/auction-watcher.service';
import { MyBidsReadModel } from '../../read-models/my-bids.read-model';
import { CreateAuctionSchema, CreateAuctionDto } from '../../dto/create-auction.dto';
import { UpdateAuctionSchema, UpdateAuctionDto } from '../../dto/update-auction.dto';
import { QueryAuctionsSchema, QueryAuctionsDto } from '../../dto/query-auction.dto';
import { QueryAuctionWatchersSchema, QueryAuctionWatchersDto } from '../../dto/query-auction-watcher.dto';
import { AuctionPermissions, canModerateAuction } from '../../policies/auctions.policies';

const ipOf = (req: Request) => req.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'auctions', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionService, private readonly watchers: AuctionWatcherService, private readonly myBids: MyBidsReadModel) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateAuction(ctx) }; }

  @Post() @RequirePermissions(AuctionPermissions.Create)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateAuctionSchema) dto: CreateAuctionDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.auctions.create(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAuctionsSchema) q: QueryAuctionsDto) {
    return this.auctions.list(ctx.tenantId, { status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  // static routes declared BEFORE ':id' so 'watching'/'my-bids' aren't captured as an auction id
  @Get('watching')
  watching(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAuctionWatchersSchema) q: QueryAuctionWatchersDto) {
    return this.watchers.listMine(ctx.tenantId, ctx.userId, { cursor: q.cursor, limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  /** The caller's OWN bids across ALL auctions (keyset), each with its EMD hold + winning flag. */
  @Get('my-bids')
  myBidsList(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAuctionWatchersSchema) q: QueryAuctionWatchersDto) {
    return this.myBids.forBidder(ctx.tenantId, ctx.userId, { cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.auctions.getById(ctx.tenantId, id).then((data) => ({ data })); }

  /** Seller (or moderator) edits a SCHEDULED auction's terms. */
  @Patch(':id') @RequirePermissions(AuctionPermissions.Create)
  update(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(UpdateAuctionSchema) dto: UpdateAuctionDto) {
    return this.auctions.updateScheduled(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data }));
  }

  // watch-list: any authed member may watch an auction in their tenant (idempotent)
  @Post(':id/watch')
  watch(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.watchers.watch(ctx.tenantId, ctx.userId, id).then((data) => ({ data })); }
  @Delete(':id/watch')
  unwatch(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.watchers.unwatch(ctx.tenantId, ctx.userId, id).then((data) => ({ data })); }

  @Post(':id/approve')
  approve(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.auctions.approve(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then(() => ({ data: { ok: true } })); }

  @Post(':id/cancel')
  cancel(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.auctions.cancel(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then(() => ({ data: { ok: true } })); }
}
