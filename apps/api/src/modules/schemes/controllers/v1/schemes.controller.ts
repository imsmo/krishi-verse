// modules/schemes/controllers/v1/schemes.controller.ts · read-only scheme catalogue + authority browse. `schemes` flag.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { SchemeService } from '../../services/scheme.service';
import { QuerySchemesSchema, QuerySchemesDto } from '../../dto/query-scheme.dto';
import { QueryAuthoritiesSchema, QueryAuthoritiesDto } from '../../dto/query-scheme-authority.dto';

@Controller({ path: 'schemes', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('schemes')
export class SchemesController {
  constructor(private readonly svc: SchemeService) {}

  @Get('authorities')
  authorities(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAuthoritiesSchema) q: QueryAuthoritiesDto) { return this.svc.listAuthorities(ctx.tenantId, q.level).then((data) => ({ data })); }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QuerySchemesSchema) q: QuerySchemesDto) { return this.svc.list(ctx.tenantId, { categoryId: q.categoryId, activeOnly: q.activeOnly }).then((data) => ({ data })); }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, id).then((data) => ({ data })); }
}
