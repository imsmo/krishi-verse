// modules/catalogue/controllers/v1/brands.controller.ts · browse global brands (product/listing brand picker).
// GLOBAL read (browse); validate→delegate only. Brand WRITES live in apps/admin-api (Law 11).
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BrandService } from '../../services/brand.service';
import { QueryBrandSchema, QueryBrandDto } from '../../dto/query-brand.dto';

@Controller({ path: 'brands', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class BrandsController {
  constructor(private readonly brands: BrandService) {}
  @Public() @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryBrandSchema) q: QueryBrandDto) {
    return this.brands.list(ctx.tenantId, q).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Public() @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.brands.get(ctx.tenantId, id).then((data) => ({ data }));
  }
}
