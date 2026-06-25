// modules/lookups/controllers/v1/lookups.controller.ts · PUBLIC reference-data reads (P1-9): controlled
// vocabularies + admin regions, locale-resolved from the request context. @Public (anonymous storefront facets
// need these), but still tenant-scoped — lookup_values resolves the caller's tenant's own values plus platform
// values. Read-only; no writes here (master-data writes are god-mode, in apps/admin-api, Law 11).
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { LookupsService } from '../../lookups.service';
import { LookupValuesQuerySchema, LookupValuesQueryDto, RegionsQuerySchema, RegionsQueryDto } from '../../dto/query-lookups.dto';

@Controller({ path: 'lookups', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  /** A controlled vocabulary by type code (e.g. ?type=doc_type), platform + tenant values, locale-resolved. */
  @Public() @Get('values')
  values(@CurrentContext() ctx: RequestContext, @ZodQuery(LookupValuesQuerySchema) q: LookupValuesQueryDto) {
    return this.lookups.values(ctx.tenantId, ctx.lang, q.type).then((data) => ({ data }));
  }

  /** Admin regions: states (default) or a parent's children (?parentId=…), locale-resolved. */
  @Public() @Get('regions')
  regions(@CurrentContext() ctx: RequestContext, @ZodQuery(RegionsQuerySchema) q: RegionsQueryDto) {
    return this.lookups.regions(ctx.tenantId, ctx.lang, { parentId: q.parentId, level: q.level }).then((data) => ({ data }));
  }
}
