// modules/catalogue/controllers/v1/attribute-templates.controller.ts · browse clonable presets + fetch one by
// code (listing-create "use a template" flow). GLOBAL read (browse); validate→delegate only. Template WRITES live
// in apps/admin-api (Law 11). The `:code` route is keyed by the template's stable code (UNIQUE), not a uuid.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { AttributeTemplateService } from '../../services/attribute-template.service';
import { QueryAttributeTemplateSchema, QueryAttributeTemplateDto } from '../../dto/query-attribute-template.dto';

@Controller({ path: 'attribute-templates', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class AttributeTemplatesController {
  constructor(private readonly templates: AttributeTemplateService) {}
  @Public() @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAttributeTemplateSchema) q: QueryAttributeTemplateDto) {
    return this.templates.list(ctx.tenantId, q).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Public() @Get(':code')
  getByCode(@CurrentContext() ctx: RequestContext, @Param('code') code: string) {
    return this.templates.getByCode(ctx.tenantId, code).then((data) => ({ data }));
  }
}
