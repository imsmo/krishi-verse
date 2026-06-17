// modules/catalogue/controllers/v1/categories.controller.ts · browse tree + per-tenant enable.
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { CategoryService } from '../../services/category.service';
import { QueryCategorySchema, QueryCategoryDto, ToggleTenantCategorySchema, ToggleTenantCategoryDto } from '../../dto/query-category.dto';
import { CataloguePermissions } from '../../policies/catalogue.policies';

const ipOf = (req: Request) => req.ip || null;

@Controller({ path: 'categories', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoryService) {}
  @Public() @Get()
  tree(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryCategorySchema) q: QueryCategoryDto) {
    return this.categories.tree(ctx.tenantId, q).then((data) => ({ data }));
  }
  @Post('tenant-toggle')
  @RequirePermissions(CataloguePermissions.Configure)
  toggle(@CurrentContext() ctx: RequestContext, @Req() req: Request, @ZodBody(ToggleTenantCategorySchema) dto: ToggleTenantCategoryDto) {
    return this.categories.toggleTenantCategory(ctx.tenantId, ctx.userId, dto, ipOf(req)).then((data) => ({ data }));
  }
}
