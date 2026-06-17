// modules/payments/__tests__/payout-gateway.spec.ts · sandbox money-OUT gateway outcomes.
import { SandboxPayoutGateway } from '../gateway/sandbox-payout.gateway';
import { InfraError } from '../../../shared/errors/app-error';

const input = { amountMinor: 1000n, currencyCode: 'INR', fundAccountRef: 'fa_1', idempotencyKey: 'payout:1' };

describe('SandboxPayoutGateway', () => {
  it('returns success by default', async () => {
    const r = await new SandboxPayoutGateway('success').createPayout(input);
    expect(r.status).toBe('success');
    expect(r.gatewayPayoutId).toContain('sbx_payout_');
  });
  it('returns a DEFINITIVE failure (safe to reverse) in failed mode', async () => {
    const r = await new SandboxPayoutGateway('failed').createPayout(input);
    expect(r.status).toBe('failed');
    expect(r.failureCode).toBeTruthy();
  });
  it('throws InfraError for an ambiguous transport failure (must NOT reverse)', async () => {
    await expect(new SandboxPayoutGateway('infra').createPayout(input)).rejects.toBeInstanceOf(InfraError);
  });
});
