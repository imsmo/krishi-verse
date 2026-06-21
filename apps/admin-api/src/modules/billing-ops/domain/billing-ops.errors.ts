// apps/admin-api/src/modules/billing-ops/domain/billing-ops.errors.ts · typed errors → HTTP via HttpException
// subclasses with stable codes (mirrors recon-monitor / compliance-ops).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class SaasInvoiceNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('SAAS_INVOICE_NOT_FOUND', `saas invoice ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class BillingTenantNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('BILLING_TENANT_NOT_FOUND', `tenant ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class InvalidAdjustmentError extends DomainHttpError {
  constructor(detail: string) { super('BILLING_ADJUSTMENT_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class InvalidDunningError extends DomainHttpError {
  constructor(detail: string) { super('BILLING_DUNNING_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
/** The wallet-service rejected or could not apply the money move (frozen/insufficient/unavailable). Never a partial. */
export class WalletAdjustmentFailedError extends DomainHttpError {
  constructor(detail: string) { super('BILLING_WALLET_ADJUSTMENT_FAILED', `manual adjustment not applied: ${detail}`, HttpStatus.BAD_GATEWAY, { detail }); }
}
