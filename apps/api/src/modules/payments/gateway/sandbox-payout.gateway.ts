// modules/payments/gateway/sandbox-payout.gateway.ts
// Deterministic money-OUT gateway for tests/local. Default: instant 'success'. Construct with
// mode 'failed' to exercise the failure→reversal path, or 'infra' to simulate an ambiguous
// transport error (caller must keep the payout queued, NOT reverse).
import { InfraError } from '../../../shared/errors/app-error';
import { PayoutGateway, CreatePayoutInput, CreatePayoutResult } from './payout-gateway.port';

export type SandboxPayoutMode = 'success' | 'failed' | 'infra';

export class SandboxPayoutGateway implements PayoutGateway {
  readonly providerCode = 'sandbox';
  constructor(private readonly mode: SandboxPayoutMode = 'success') {}

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    if (this.mode === 'infra') throw new InfraError('SANDBOX_PAYOUT_INFRA', 'simulated transport failure', {});
    if (this.mode === 'failed') return { gatewayPayoutId: `sbx_payout_${input.idempotencyKey}`, status: 'failed', failureCode: 'account_invalid', failureReason: 'sandbox forced failure' };
    return { gatewayPayoutId: `sbx_payout_${input.idempotencyKey}`, status: 'success' };
  }
}
