// modules/listings/controllers/sellers.controller.ts · public seller storefront profile.
// GET sellers/:id/public — SAFE public fields + rating rollup + active-listing count. NO PII.
// @Public (anonymous storefront; tenant resolved from token or X-Tenant-Id), replica-backed + RLS.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../core/auth/permissions.guard';
import { Public } from '../../../core/auth/public.decorator';
import { CurrentContext } from '../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../core/tenancy-context/request-context';
import { SellerProfileReadModel } from '../read-models/seller-profile.read-model';
import { SellerNotFoundError } from '../domain/listing.errors';

@Controller({ path: 'sellers', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class SellersController {
  constructor(private readonly profiles: SellerProfileReadModel) {}

  @Public() @Get(':id/public')
  async publicProfile(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    const data = await this.profiles.forSeller(ctx.tenantId, id);
    if (!data) throw new SellerNotFoundError(id);
    return { data };
  }
}
