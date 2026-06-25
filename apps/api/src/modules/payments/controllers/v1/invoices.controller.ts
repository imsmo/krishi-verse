// modules/payments/controllers/v1/invoices.controller.ts · buyer-facing GST trade invoices.
// Read-only: the invoice for an order, visible to that order's buyer/seller or a finance moderator
// (404 to anyone else — no IDOR / cross-tenant enumeration). Generation is automatic at order
// completion (TradeInvoiceHandler), not via a public endpoint.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { TradeInvoiceService } from '../../services/trade-invoice.service';
import { canModeratePayment } from '../../policies/payments.policies';

@Controller({ path: 'invoices', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private readonly invoices: TradeInvoiceService) {}

  @Get('order/:orderId')
  byOrder(@CurrentContext() ctx: RequestContext, @Param('orderId') orderId: string) {
    return this.invoices.getByOrder(ctx.tenantId, { userId: ctx.userId, canModerate: canModeratePayment(ctx) }, orderId).then((data) => ({ data }));
  }

  // A short-lived presigned PDF download URL for the order's invoice — buyer/seller/finance only (404 else).
  @Get('order/:orderId/download')
  download(@CurrentContext() ctx: RequestContext, @Param('orderId') orderId: string) {
    return this.invoices.downloadUrlForOrder(ctx.tenantId, { userId: ctx.userId, canModerate: canModeratePayment(ctx) }, orderId).then((data) => ({ data }));
  }
}
