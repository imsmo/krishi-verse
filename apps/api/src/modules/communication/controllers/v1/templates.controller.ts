// modules/communication/controllers/v1/templates.controller.ts · tenant template authoring + catalog browse.
// Authoring requires notification.manage; a tenant writes only its OWN templates (service enforces, Law 11).
// `communication` flag.
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { TemplateAdminService } from '../../services/template-admin.service';
import { CommPermissions } from '../../policies/communication.policies';
import { UpsertTemplateSchema, UpsertTemplateDto } from '../../dto/create-notification-template.dto';
import { QueryTemplatesSchema, QueryTemplatesDto } from '../../dto/query-notification-template.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'notifications', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('communication')
export class TemplatesController {
  constructor(private readonly svc: TemplateAdminService) {}

  @Get('events') @RequirePermissions(CommPermissions.Manage)
  catalog() { return this.svc.listCatalog().then((data) => ({ data })); }

  @Get('templates') @RequirePermissions(CommPermissions.Manage)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryTemplatesSchema) q: QueryTemplatesDto) {
    return this.svc.list(ctx.tenantId, { eventCode: q.eventCode, channel: q.channel, languageCode: q.languageCode, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Post('templates') @RequirePermissions(CommPermissions.Manage)
  upsert(@CurrentContext() ctx: RequestContext, @ZodBody(UpsertTemplateSchema) dto: UpsertTemplateDto) {
    return this.svc.upsert(ctx.tenantId, ctx.userId, { ...dto, subject: dto.subject ?? null, providerTemplateRef: dto.providerTemplateRef ?? null }).then((data) => ({ data }));
  }
}
