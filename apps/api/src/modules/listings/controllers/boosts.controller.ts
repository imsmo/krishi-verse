// modules/listings/controllers/boosts.controller.ts · start a paid visibility boost.
import { Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../core/http/zod.pipe';
import { CurrentContext } from '../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../shared/errors/app-error';
import { ListingBoostService } from '../services/listing-boost.service';
import { CreateBoostDto, CreateBoostSchema, PayBoostFromWalletDto, PayBoostFromWalletSchema } from '../dto/create-listing-boost.dto';
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

  /** Pay for a boost straight from the wallet. The server resolves the tier's authoritative price/days
   *  (the client never sends money); the wallet ledger fails closed on insufficient balance. Idempotent. */
  @Post('pay-from-wallet')
  @RequirePermissions(ListingPermissions.Boost)
  async payFromWallet(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @Param('id') id: string, @ZodBody(PayBoostFromWalletSchema) dto: PayBoostFromWalletDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return { data: await this.service.payFromWallet(ctx.tenantId, ctx.userId, key, id, dto.boostTierId, dto.currencyCode ?? 'INR') };
  }
}
