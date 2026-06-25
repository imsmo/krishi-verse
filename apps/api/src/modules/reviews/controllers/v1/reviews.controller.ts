// modules/reviews/controllers/v1/reviews.controller.ts · verified-purchase reviews (validate→authorize→
// delegate). Submit needs review.create + Idempotency-Key (verified-purchase enforced in the service);
// edit is author-only; respond is the reviewed party; moderate needs review.moderate. Public target
// lists/summary read only published reviews. Gated by the `reviews` feature flag.
import { Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ReviewService } from '../../services/review.service';
import { CreateReviewSchema, CreateReviewDto } from '../../dto/create-review.dto';
import { EditReviewSchema, EditReviewDto, SellerResponseSchema, SellerResponseDto, ModerateReviewSchema, ModerateReviewDto } from '../../dto/update-review.dto';
import { QueryReviewsSchema, QueryReviewsDto, ReviewSummaryQuerySchema, ReviewSummaryQueryDto, PublicReviewsQuerySchema, PublicReviewsQueryDto } from '../../dto/query-review.dto';
import { ReviewPermissions, canModerateReview } from '../../policies/reviews.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'reviews', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateReview(ctx) }; }

  @Post() @RequirePermissions(ReviewPermissions.Create)
  submit(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateReviewSchema) dto: CreateReviewDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.reviews.submit(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  // Public aggregate rating for a target (anonymous storefront) — only published reviews are counted.
  @Public() @Get('summary')
  summary(@CurrentContext() ctx: RequestContext, @ZodQuery(ReviewSummaryQuerySchema) q: ReviewSummaryQueryDto) {
    return this.reviews.summary(ctx.tenantId, q.targetType, q.targetId).then((data) => ({ data }));
  }

  // Public individual-reviews list for a target (anonymous storefront). PII-free projection (no reviewer id),
  // published-only, keyset-paginated. Distinct from the authenticated `GET` list (which a party uses for their own).
  @Public() @Get('public')
  publicList(@CurrentContext() ctx: RequestContext, @ZodQuery(PublicReviewsQuerySchema) q: PublicReviewsQueryDto) {
    return this.reviews.publicList(ctx.tenantId, { targetType: q.targetType, targetId: q.targetId, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryReviewsSchema) q: QueryReviewsDto) {
    return this.reviews.list(ctx.tenantId, this.actor(ctx), { box: q.box, targetType: q.targetType, targetId: q.targetId, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.reviews.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Patch(':id')
  edit(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(EditReviewSchema) dto: EditReviewDto) {
    return this.reviews.edit(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data }));
  }

  @Post(':id/respond')
  respond(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(SellerResponseSchema) dto: SellerResponseDto) {
    return this.reviews.respond(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data }));
  }

  @Post(':id/moderate') @RequirePermissions(ReviewPermissions.Moderate)
  moderate(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(ModerateReviewSchema) dto: ModerateReviewDto) {
    return this.reviews.moderate(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data }));
  }
}
