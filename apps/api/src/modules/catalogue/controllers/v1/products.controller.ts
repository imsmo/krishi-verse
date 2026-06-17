// modules/catalogue/controllers/v1/products.controller.ts · browse/search + tenant-private CRUD.
import { Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../../core/idempotency/idempotency.service';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ProductService } from '../../services/product.service';
import { ProductSearchReadModel } from '../../read-models/product-search.read-model';
import { CreateProductSchema, CreateProductDto, UpdateProductSchema, UpdateProductDto } from '../../dto/create-product.dto';
import { QueryProductSchema, QueryProductDto } from '../../dto/query-product.dto';
import { CataloguePermissions } from '../../policies/catalogue.policies';

@Controller({ path: 'products', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly products: ProductService, private readonly search: ProductSearchReadModel, @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService) {}

  @Public() @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryProductSchema) q: QueryProductDto) {
    return this.search.query(ctx.tenantId, q).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Public() @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.products.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Post()
  @RequirePermissions(CataloguePermissions.ProductManage)
  async create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateProductSchema) dto: CreateProductDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.idem.remember(key, ctx.userId, 'catalogue.product.create', () => this.products.create(ctx.tenantId, ctx.userId, key, dto));
    return { data };
  }
  @Patch(':id')
  @RequirePermissions(CataloguePermissions.ProductManage)
  async update(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(UpdateProductSchema) dto: UpdateProductDto) {
    await this.products.update(ctx.tenantId, ctx.userId, id, dto); return { data: { ok: true } };
  }
  @Post(':id/deactivate')
  @RequirePermissions(CataloguePermissions.ProductManage)
  async deactivate(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    await this.products.deactivate(ctx.tenantId, ctx.userId, id); return { data: { ok: true } };
  }
}
