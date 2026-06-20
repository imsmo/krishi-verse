// modules/education/controllers/v1/live-sessions.controller.ts · schedule + run + attend live sessions.
// schedule/start/end/cancel need channel.host (own approved channel + own session); register + browse are any
// authenticated user. start provisions the stream via the external provider. `education` flag.
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { LiveSessionService } from '../../services/live-session.service';
import { EducationPermissions, canAuthor, canPublish, isEducationAdmin, canHost, canModerateContent } from '../../policies/education.policies';
import { ScheduleLiveSchema, ScheduleLiveDto, QueryLiveSchema, QueryLiveDto } from '../../dto/schedule-live.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'education/live-sessions', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('education')
export class LiveSessionsController {
  constructor(private readonly svc: LiveSessionService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canAuthor: canAuthor(ctx), canPublish: canPublish(ctx), isAdmin: isEducationAdmin(ctx), canHost: canHost(ctx), canModerate: canModerateContent(ctx) }; }

  @Post() @RequirePermissions(EducationPermissions.Host)
  schedule(@CurrentContext() ctx: RequestContext, @ZodBody(ScheduleLiveSchema) dto: ScheduleLiveDto) { return this.svc.schedule(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data })); }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryLiveSchema) q: QueryLiveDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Post(':id/start') @RequirePermissions(EducationPermissions.Host)
  start(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.start(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/end') @RequirePermissions(EducationPermissions.Host)
  end(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Body('recordingMediaId') recordingMediaId?: string) { return this.svc.end(ctx.tenantId, this.actor(ctx), id, recordingMediaId ?? null).then((data) => ({ data })); }
  @Post(':id/cancel') @RequirePermissions(EducationPermissions.Host)
  cancel(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.cancel(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/register')
  register(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.register(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
}
