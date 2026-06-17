// modules/payments/gateway/razorpayx.gateway.ts
// RazorpayX adapter for money-OUT. The create-payout call is resilience-wrapped (timeout +
// circuit-breaker; money: NO auto-retry without the idempotency key, NO fallback). A transport
// failure throws InfraError (caller keeps the payout queued + retries — RazorpayX dedups on the
// idempotency key). A definitive PSP rejection is returned as status:'failed' (safe to reverse).
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { InfraError } from '../../../shared/errors/app-error';
import { PayoutGateway, CreatePayoutInput, CreatePayoutResult } from './payout-gateway.port';

const DEP = 'razorpayx';

export interface RazorpayXConfig { keyId: string; keySecret: string; accountNumber: string; baseUrl?: string; }

export class RazorpayXGateway implements PayoutGateway {
  readonly providerCode = 'razorpayx';
  constructor(private readonly cfg: RazorpayXConfig, private readonly resilience: ResilienceService) {}

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    return this.resilience.run(DEP, async () => {
      const res = await fetch(`${this.cfg.baseUrl ?? 'https://api.razorpay.com'}/v1/payouts`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-payout-idempotency': input.idempotencyKey,        // RazorpayX idempotency header
          authorization: 'Basic ' + Buffer.from(`${this.cfg.keyId}:${this.cfg.keySecret}`).toString('base64'),
        },
        body: JSON.stringify({
          account_number: this.cfg.accountNumber, fund_account_id: input.fundAccountRef,
          amount: Number(input.amountMinor), currency: input.currencyCode, mode: 'IMPS',
          purpose: input.purpose ?? 'payout', queue_if_low_balance: true,
          reference_id: input.idempotencyKey,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as any;
      if (res.status === 400 || res.status === 422) {
        // definitive rejection (bad account, etc.) → safe to reverse
        return { gatewayPayoutId: body?.id ?? '', status: 'failed', failureCode: body?.error?.code ?? 'rejected', failureReason: body?.error?.description ?? 'rejected by gateway' };
      }
      if (!res.ok) throw new InfraError('RAZORPAYX_PAYOUT_FAILED', `RazorpayX payout failed (${res.status})`, { status: res.status }); // ambiguous → retry, never reverse
      // RazorpayX disburses asynchronously; the terminal state arrives via the payout webhook.
      return { gatewayPayoutId: body.id, status: 'processing' };
    }, { money: true });
  }
}
