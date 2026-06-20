// modules/ai-governance/controllers/v1/moderation.controller.ts · content abuse reports. FILE needs only
// authentication (any user can report content — no @RequirePermissions on that route); LIST/GET/HANDLE need
// content.moderate. validate→authorize→delegate only. `ai_governance` flag.
import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { ModerationService } from '../../services/moderation.service';
import { AiPermissions, canReviewAi, canModerateContent } from '../../policies/ai-governance.policies';
import { FileReportSchema, FileReportDto } from '../../dto/file-moderation-report.dto';
import { HandleReportSchema, HandleReportDto } from '../../dto/handle-moderation.dto';
import { QueryModerationSchema, QueryModerationDto } from '../../dto/query-moderation.dto';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'ai/moderation/reports', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('ai_governance')
export class ModerationController {
  constructor(private readonly svc: ModerationService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canReview: canReviewAi(ctx), canModerate: canModerateContent(ctx) }; }

  @Post()   // no @RequirePermissions — any authenticated user may report content
  file(@CurrentContext() ctx: RequestContext, @ZodBody(FileReportSchema) dto: FileReportDto) {
    return this.svc.file(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data }));
  }
  @Get() @RequirePermissions(AiPermissions.Moderate)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryModerationSchema) q: QueryModerationDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, subjectType: q.subjectType, subjectId: q.subjectId, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id') @RequirePermissions(AiPermissions.Moderate)
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data }));
  }
  @Post(':id/handle') @RequirePermissions(AiPermissions.Moderate)
  handle(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Req() req: Request, @ZodBody(HandleReportSchema) dto: HandleReportDto) {
    return this.svc.handle(ctx.tenantId, this.actor(ctx), id, dto, ipOf(req)).then((data) => ({ data }));
  }
}
