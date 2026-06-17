// modules/listings/controllers/boosts.controller.ts · start a paid visibility boost.
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../core/http/zod.pipe';
import { CurrentContext } from '../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../core/tenancy-context/request-context';
import { ListingBoostService } from '../services/listing-boost.service';
import { CreateBoostDto, CreateBoostSchema } from '../dto/create-listing-boost.dto';
import { ListingPermissions } from '../listings.policies';

@Controller({ path: 'listings/:id/boosts', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('listing_boost')
export class BoostsController {
  constructor(private readonly service: ListingBoostService) {}
  @Post()
  @RequirePermissions(ListingPermissions.Boost)
  async start(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(CreateBoostSchema) dto: CreateBoostDto) {
    // dto.paymentTxnId proves wallet-service already captured payment (Law 2).
    await this.service.start(ctx.tenantId, ctx.userId, id, dto.boostTierId, BigInt(dto.priceMinor), dto.currencyCode, dto.days, dto.paymentTxnId);
    return { data: { ok: true } };
  }
}
