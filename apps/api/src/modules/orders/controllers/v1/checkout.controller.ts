// modules/orders/controllers/v1/checkout.controller.ts · convert the active cart into orders.
import { Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { CheckoutService } from '../../services/checkout.service';
import { CheckoutSchema, CheckoutDto } from '../../dto/create-order.dto';
import { OrderPermissions } from '../../policies/orders.policies';

@Controller({ path: 'checkout', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}
  // Idempotency is owned by CheckoutService (it wraps the whole cart→orders tx under this key).
  // The controller MUST NOT also wrap it — a second remember() with the same scoped key would see
  // the service's in-progress claim and wrongly reject the very first request as a duplicate.
  @Post() @RequirePermissions(OrderPermissions.Create)
  async go(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CheckoutSchema) dto: CheckoutDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.checkout.checkout(ctx.tenantId, ctx.userId, key, dto);
    return { data };
  }
}
