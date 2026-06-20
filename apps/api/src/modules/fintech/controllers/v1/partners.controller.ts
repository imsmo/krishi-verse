// modules/fintech/controllers/v1/partners.controller.ts · read-only lender + loan-product browse. `fintech` flag.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { FinancialPartnerService } from '../../services/financial-partner.service';
import { QueryPartnersSchema, QueryPartnersDto } from '../../dto/query-financial-partner.dto';
import { QueryLoanProductsSchema, QueryLoanProductsDto } from '../../dto/query-loan-product.dto';

@Controller({ path: 'fintech', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('fintech')
export class PartnersController {
  constructor(private readonly svc: FinancialPartnerService) {}

  @Get('partners')
  listPartners(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryPartnersSchema) q: QueryPartnersDto) { return this.svc.listPartners(ctx.tenantId, { partnerKind: q.partnerKind, activeOnly: q.activeOnly }).then((data) => ({ data })); }
  @Get('partners/:id')
  getPartner(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getPartner(ctx.tenantId, id).then((data) => ({ data })); }
  @Get('loan-products')
  listProducts(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryLoanProductsSchema) q: QueryLoanProductsDto) { return this.svc.listProducts(ctx.tenantId, { partnerId: q.partnerId, activeOnly: q.activeOnly }).then((data) => ({ data })); }
  @Get('loan-products/:id')
  getProduct(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getProduct(ctx.tenantId, id).then((data) => ({ data })); }
}
