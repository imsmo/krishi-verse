// modules/buyer/controllers/v1/saved-searches.controller.ts · the buyer's saved searches (re-runnable filters).
// POST   buyer/saved-searches      — save a search (name + query + optional new-match notify)
// GET    buyer/saved-searches      — the caller's saved searches
// DELETE buyer/saved-searches/:id  — delete one (owner-scoped; not-yours == 404)
import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { SavedService } from '../../services/saved.service';
import { CreateSavedSearchSchema, CreateSavedSearchDto } from '../../dto/saved.dto';

@Controller({ path: 'buyer/saved-searches', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class SavedSearchesController {
  constructor(private readonly svc: SavedService) {}

  @Post()
  create(@CurrentContext() ctx: RequestContext, @ZodBody(CreateSavedSearchSchema) dto: CreateSavedSearchDto) {
    return this.svc.createSearch(ctx.tenantId, ctx.userId, dto.name, dto.query, dto.notifyNewMatches ?? false).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext) {
    return this.svc.listSearches(ctx.tenantId, ctx.userId).then((data) => ({ data }));
  }

  @Delete(':id')
  remove(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.deleteSearch(ctx.tenantId, ctx.userId, id).then((data) => ({ data }));
  }
}
