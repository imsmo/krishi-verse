// apps/admin-api/src/modules/recon-monitor/domain/recon-monitor.errors.ts · typed errors → HTTP via
// HttpException subclasses with stable codes (mirrors ai-models-ops / tenant-ops).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class ReconRunNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('RECON_RUN_NOT_FOUND', `reconciliation run ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class InvestigationNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('RECON_INVESTIGATION_NOT_FOUND', `investigation ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class WalletAccountNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('WALLET_ACCOUNT_NOT_FOUND', `wallet account ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class InvalidFreezeStateError extends DomainHttpError {
  constructor(detail: string) { super('WALLET_FREEZE_INVALID', detail, HttpStatus.CONFLICT, { detail }); }
}
export class DuplicateInvestigationError extends DomainHttpError {
  constructor(runId: string) { super('RECON_INVESTIGATION_DUPLICATE', `an open investigation already exists for run ${runId}`, HttpStatus.CONFLICT, { runId }); }
}
