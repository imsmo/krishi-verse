// modules/search/controllers/v1/search.controller.ts · the single cross-entity search endpoint.
// GET /v1/search?q=&types=&cursor=&limit= — authenticated (tenant-scoped; results are RLS/tenant-isolated),
// behind the `unified_search` flag. validate→authorize→delegate only. Returns a ranked, federated-cursor page
// with the engine used (`opensearch` | `postgres`) so a degrade is observable. Read-only (no writes, no idem).
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { SearchService } from '../../services/search.service';
import { QuerySearchSchema, QuerySearchDto } from '../../dto/search.dto';

@Controller({ path: 'search', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('unified_search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  search(@CurrentContext() ctx: RequestContext, @ZodQuery(QuerySearchSchema) q: QuerySearchDto) {
    return this.svc.search(ctx.tenantId, q).then((res) => ({ data: res.items, meta: { engine: res.engine, nextCursor: res.nextCursor } }));
  }
}
