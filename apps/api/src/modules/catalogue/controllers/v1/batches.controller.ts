// modules/catalogue/controllers/v1/batches.controller.ts · tenant store inventory (regulated inputs).
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../../core/idempotency/idempotency.service';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ProductBatchService } from '../../services/product-batch.service';
import { CreateBatchSchema, CreateBatchDto, RecallBatchSchema, RecallBatchDto, QueryBatchSchema, QueryBatchDto } from '../../dto/create-product-batch.dto';
import { CataloguePermissions } from '../../policies/catalogue.policies';

@Controller({ path: 'product-batches', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('product_batches')
export class BatchesController {
  constructor(private readonly batches: ProductBatchService, @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService) {}
  @Get() @RequirePermissions(CataloguePermissions.ProductManage)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryBatchSchema) q: QueryBatchDto) { return this.batches.list(ctx.tenantId, q).then((data) => ({ data })); }

  @Post() @RequirePermissions(CataloguePermissions.ProductManage)
  async create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateBatchSchema) dto: CreateBatchDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.idem.remember(key, ctx.userId, 'catalogue.batch.create', () => this.batches.create(ctx.tenantId, ctx.userId, key, dto));
    return { data };
  }
  @Post(':id/recall') @RequirePermissions(CataloguePermissions.ProductManage)
  async recall(@CurrentContext() ctx: RequestContext, @Req() req: Request, @Param('id') id: string, @ZodBody(RecallBatchSchema) dto: RecallBatchDto) {
    return { data: await this.batches.recall(ctx.tenantId, ctx.userId, id, dto.reason, req.ip || null) };
  }
}
