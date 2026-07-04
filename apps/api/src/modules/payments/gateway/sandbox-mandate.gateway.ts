// modules/payments/gateway/sandbox-mandate.gateway.ts
// Deterministic sandbox UPI-AutoPay mandate gateway (NON-prod ONLY — registered exactly like the sandbox
// money-IN gateway, and never in production where a real PSP is mandatory). It fabricates NO money: it only
// returns stable, deterministic provider references so the confirm/collect flow can be exercised end-to-end
// in dev/test. The actual funds move through WalletPort.post; this adapter never touches the ledger.
import {
  MandateGateway, ConfirmMandateInput, ConfirmMandateResult, CollectInput, CollectResult,
} from './mandate-gateway.port';

export class SandboxMandateGateway implements MandateGateway {
  readonly providerCode = 'sandbox';

  async confirmMandate(input: ConfirmMandateInput): Promise<ConfirmMandateResult> {
    // Deterministic token derived from the mandate id — stable across retries (idempotent confirm).
    return { providerMandateRef: `sbx_mndt_${input.mandateId.replace(/-/g, '').slice(0, 24)}` };
  }

  async collect(input: CollectInput): Promise<CollectResult> {
    // Deterministic collection ref keyed on the idempotency key — a replay yields the same ref.
    const key = input.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || 'k';
    return { providerPaymentRef: `sbx_coll_${key}` };
  }
}
