// modules/ai-governance/controllers/v1/review-queue.controller.ts · the human-in-the-loop queue. List/claim/
// resolve + manual enqueue — all need ai.review. validate→authorize→delegate only. `ai_governance` flag.
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { AiReviewService } from '../../services/ai-review.service';
import { AiPermissions, canReviewAi, canModerateContent } from '../../policies/ai-governance.policies';
import { CreateReviewSchema, CreateReviewDto } from '../../dto/create-ai-review.dto';
import { QueryReviewsSchema, QueryReviewsDto } from '../../dto/query-ai-review.dto';
import { ResolveReviewSchema, ResolveReviewDto } from '../../dto/resolve-ai-review.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'ai/review-queue', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('ai_governance')
export class ReviewQueueController {
  constructor(private readonly svc: AiReviewService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canReview: canReviewAi(ctx), canModerate: canModerateContent(ctx) }; }

  @Get() @RequirePermissions(AiPermissions.Review)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryReviewsSchema) q: QueryReviewsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, queueKind: q.queueKind, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Post() @RequirePermissions(AiPermissions.Review)
  enqueue(@CurrentContext() ctx: RequestContext, @ZodBody(CreateReviewSchema) dto: CreateReviewDto) {
    return this.svc.enqueueManual(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data }));
  }
  @Get(':id') @RequirePermissions(AiPermissions.Review)
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data }));
  }
  @Post(':id/claim') @RequirePermissions(AiPermissions.Review)
  claim(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.claim(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data }));
  }
  @Post(':id/resolve') @RequirePermissions(AiPermissions.Review)
  resolve(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(ResolveReviewSchema) dto: ResolveReviewDto) {
    return this.svc.resolve(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data }));
  }
}
