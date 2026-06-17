// modules/payments/gateway/sandbox.gateway.ts
// Deterministic in-memory gateway for tests + local dev (no network). Signature scheme mirrors
// Razorpay (HMAC-SHA256 over the raw body) so the webhook-verification code path is exercised for
// real. Used when provider_code='sandbox' or no real PSP is configured.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentGateway, CreateOrderInput, CreateOrderResult, GatewayEvent } from './payment-gateway.port';

export class SandboxGateway implements PaymentGateway {
  readonly providerCode = 'sandbox';
  constructor(private readonly secret = 'sandbox-secret') {}

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return { gatewayOrderId: `sbx_order_${input.receipt}` };
  }

  /** Sign a body the way the sandbox "gateway" would — used by tests to craft valid webhooks. */
  sign(rawBody: string): string { return createHmac('sha256', this.secret).update(rawBody).digest('hex'); }

  verifySignature(rawBody: string, signature: string): boolean {
    const a = Buffer.from(this.sign(rawBody)); const b = Buffer.from(signature ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseEvent(rawBody: string): GatewayEvent {
    const p = JSON.parse(rawBody) as any;
    const map: Record<string, GatewayEvent['kind']> = { 'payment.captured': 'payment_captured', 'payment.failed': 'payment_failed', 'refund.processed': 'refund_processed' };
    return {
      eventId: p.id, kind: map[p.event] ?? 'ignored',
      tenantId: p.tenant_id,
      gatewayOrderId: p.order_id, gatewayPaymentId: p.payment_id,
      amountMinor: p.amount != null ? BigInt(p.amount) : undefined, method: p.method,
      failureCode: p.error_code, failureReason: p.error_reason,
    };
  }
}
