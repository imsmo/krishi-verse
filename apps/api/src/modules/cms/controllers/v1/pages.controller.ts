// modules/cms/controllers/v1/pages.controller.ts · CMS page authoring (admin) + public published read.
// create/update/publish/archive + admin list/get need cms.manage; GET /by-slug/:slug serves the live page to
// any authenticated user. `cms` flag. validate→authorize→delegate only.
import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { CmsPageService } from '../../services/cms-page.service';
import { CmsPermissions, canManageCms } from '../../policies/cms.policies';
import { CreatePageSchema, CreatePageDto } from '../../dto/create-cms-page.dto';
import { UpdatePageSchema, UpdatePageDto } from '../../dto/update-cms-page.dto';
import { QueryPagesSchema, QueryPagesDto } from '../../dto/query-cms-page.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'cms/pages', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('cms')
export class PagesController {
  constructor(private readonly svc: CmsPageService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageCms(ctx) }; }

  @Post() @RequirePermissions(CmsPermissions.Manage)
  create(@CurrentContext() ctx: RequestContext, @ZodBody(CreatePageSchema) dto: CreatePageDto) { return this.svc.create(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data })); }
  @Get() @RequirePermissions(CmsPermissions.Manage)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryPagesSchema) q: QueryPagesDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { pageKind: q.pageKind, status: q.status, slug: q.slug, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get('by-slug/:slug')
  bySlug(@CurrentContext() ctx: RequestContext, @Param('slug') slug: string) { return this.svc.getBySlug(ctx.tenantId, slug).then((data) => ({ data })); }
  @Get(':id') @RequirePermissions(CmsPermissions.Manage)
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Patch(':id') @RequirePermissions(CmsPermissions.Manage)
  update(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(UpdatePageSchema) dto: UpdatePageDto) { return this.svc.update(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
  @Post(':id/publish') @RequirePermissions(CmsPermissions.Manage)
  publish(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.publish(ctx.tenantId, this.actor(ctx), id, ctx.requestId).then((data) => ({ data })); }
  @Post(':id/archive') @RequirePermissions(CmsPermissions.Manage)
  archive(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.archive(ctx.tenantId, this.actor(ctx), id, ctx.requestId).then((data) => ({ data })); }
}
