// modules/payments/__tests__/razorpay-gateway.spec.ts
// Pure unit coverage for the Razorpay adapter's webhook parsing + signature verification (no network/DB).
// The captured event must surface amount AND currency (both are tamper-guarded in PaymentService.handleWebhook).
import { createHmac } from 'node:crypto';
import { RazorpayGateway } from '../gateway/razorpay.gateway';

const resilience = { run: (_d: string, fn: () => Promise<unknown>) => fn(), configure: () => {} } as any;
const gw = new RazorpayGateway({ keyId: 'rzp_test_x', keySecret: 'ks', webhookSecret: 'whsec' }, resilience);

function capturedBody(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_123', order_id: 'order_9', amount: 12345, currency: 'INR', method: 'upi', notes: { tenant_id: 't1' }, ...over } } },
  });
}

describe('RazorpayGateway.parseEvent', () => {
  it('maps payment.captured and extracts amount + uppercased currency + ids', () => {
    const e = gw.parseEvent(capturedBody());
    expect(e.kind).toBe('payment_captured');
    expect(e.amountMinor).toBe(12345n);
    expect(e.currencyCode).toBe('INR');
    expect(e.gatewayOrderId).toBe('order_9');
    expect(e.gatewayPaymentId).toBe('pay_123');
    expect(e.tenantId).toBe('t1');
  });

  it('uppercases a lowercase currency from the provider', () => {
    expect(gw.parseEvent(capturedBody({ currency: 'inr' })).currencyCode).toBe('INR');
  });

  it('leaves currency undefined when the entity omits it (no false guard)', () => {
    const e = gw.parseEvent(capturedBody({ currency: undefined }));
    expect(e.currencyCode).toBeUndefined();
  });

  it('maps unknown events to ignored', () => {
    expect(gw.parseEvent(JSON.stringify({ event: 'order.paid', payload: {} })).kind).toBe('ignored');
  });
});

describe('RazorpayGateway.verifySignature', () => {
  it('accepts a correct HMAC-SHA256 over the raw body and rejects a forged one (constant-time)', () => {
    const body = capturedBody();
    const good = createHmac('sha256', 'whsec').update(body).digest('hex');
    expect(gw.verifySignature(body, good)).toBe(true);
    expect(gw.verifySignature(body, 'deadbeef')).toBe(false);
    expect(gw.verifySignature(body, '')).toBe(false);
  });
});
