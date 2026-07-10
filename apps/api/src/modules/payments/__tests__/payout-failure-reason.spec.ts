// modules/payments/__tests__/payout-failure-reason.spec.ts · KV-BL-023 (03_API_CONTRACT_DELTA.md §payouts).
// Pins: mapProviderFailureCode buckets known raw provider codes (case/format-insensitive), an unrecognized code
// falls back to 'other' (never throws, never echoes the raw code), and PayoutService.getById/list serialize
// BOTH the raw `failureReason` (kept, additive) and the NEW `failureReasonLocalized` — null for a payout with
// no failure, resolved via the payout_failure_reason lookup_values vocabulary for one that has one.
import { mapProviderFailureCode, PAYOUT_FAILURE_REASON_FALLBACK } from '../domain/payout-failure-reason.map';
import { PayoutService } from '../services/payout.service';
import { Payout } from '../domain/payout.entity';

describe('mapProviderFailureCode', () => {
  it('maps the design-canon placeholder codes (screen 442: UPI_TIMEOUT, INSUFFICIENT_FUNDS, BANK_DECLINED)', () => {
    expect(mapProviderFailureCode('UPI_TIMEOUT')).toBe('timeout');
    expect(mapProviderFailureCode('INSUFFICIENT_FUNDS')).toBe('insufficient_funds');
    expect(mapProviderFailureCode('BANK_DECLINED')).toBe('bank_declined');
  });
  it('maps real adapter/test codes seen in this codebase (IFSC_INVALID, account_invalid, rejected, gateway_failed)', () => {
    expect(mapProviderFailureCode('IFSC_INVALID')).toBe('invalid_account');           // payout.spec.ts
    expect(mapProviderFailureCode('account_invalid')).toBe('invalid_account');        // sandbox-payout.gateway.ts
    expect(mapProviderFailureCode('rejected')).toBe('bank_declined');                 // razorpayx.gateway.ts default
    expect(mapProviderFailureCode('gateway_failed')).toBe(PAYOUT_FAILURE_REASON_FALLBACK); // payout.service.ts default
  });
  it('is case/format-insensitive (providers are inconsistent about casing/separators)', () => {
    expect(mapProviderFailureCode('upi_timeout')).toBe('timeout');
    expect(mapProviderFailureCode('Upi-Timeout')).toBe('timeout');
    expect(mapProviderFailureCode('insufficient-funds')).toBe('insufficient_funds');
  });
  it('falls back to the bank_rejected/other bucket for an unrecognized or future provider code', () => {
    expect(mapProviderFailureCode('SOME_NEW_PROVIDER_CODE_2027')).toBe('other');
    expect(mapProviderFailureCode('')).toBe('other');
  });
  it('never throws on null/undefined (a queued/processing/success payout has no failure_code)', () => {
    expect(mapProviderFailureCode(null)).toBe('other');
    expect(mapProviderFailureCode(undefined)).toBe('other');
  });
});

describe('PayoutService — failureReasonLocalized response shape', () => {
  const labels = new Map([
    ['insufficient_funds', 'Insufficient balance in the source account'],
    ['invalid_account', 'Bank account details need to be corrected'],
    ['bank_declined', 'Your bank declined this transfer'],
    ['timeout', 'The transfer timed out — you can retry'],
    ['other', 'Payment could not be completed — contact support if this repeats'],
  ]);

  function harness(payout: Payout) {
    const repo = {
      getVisible: jest.fn(async () => payout),
      listForUser: jest.fn(async () => [payout]),
      failureReasonLabels: jest.fn(async () => labels),
    };
    const svc = new PayoutService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, repo as any);
    return { svc, repo };
  }

  const failed = Payout.rehydrate({
    id: 'po1', tenantId: 't1', userId: 'u1', bankAccountId: 'b1', purposeId: 'pp1', referenceType: null, referenceId: null,
    amountMinor: 5000n, currencyCode: 'INR', status: 'failed', priority: 100, providerCode: 'razorpayx', gatewayPayoutId: 'gw1',
    idempotencyKey: 'payout:po1', failureCode: 'UPI_TIMEOUT', failureReason: 'sandbox forced failure', ledgerTxnId: 'txn1', batchId: null, createdAt: new Date('2026-01-01'),
  });
  const queued = Payout.rehydrate({
    id: 'po2', tenantId: 't1', userId: 'u1', bankAccountId: 'b1', purposeId: 'pp1', referenceType: null, referenceId: null,
    amountMinor: 5000n, currencyCode: 'INR', status: 'queued', priority: 100, providerCode: 'razorpayx', gatewayPayoutId: null,
    idempotencyKey: 'payout:po2', failureCode: null, failureReason: null, ledgerTxnId: 'txn2', batchId: null, createdAt: new Date('2026-01-01'),
  });

  it('getById keeps the raw failureReason AND adds the localized label for a failed payout', async () => {
    const h = harness(failed);
    const out = await h.svc.getById('t1', { userId: 'u1', canModerate: false }, 'po1', 'en');
    expect(out.failureReason).toBe('sandbox forced failure');           // additive: raw field kept
    expect(out.failureReasonLocalized).toBe('The transfer timed out — you can retry'); // UPI_TIMEOUT -> timeout bucket
    expect(h.repo.failureReasonLabels).toHaveBeenCalledWith('t1', 'en');
  });

  it('list() resolves failureReasonLocalized to null for a payout with no failure', async () => {
    const h = harness(queued);
    const out = await h.svc.list('t1', 'u1', { limit: 20 }, 'en');
    expect(out.items[0].failureReason).toBeNull();
    expect(out.items[0].failureReasonLocalized).toBeNull();
  });

  it('falls back to the other-bucket label if the mapped bucket has no seeded row (defensive, never throws)', async () => {
    const sparse = new Map([['other', 'Payment could not be completed — contact support if this repeats']]);
    const repo = { getVisible: jest.fn(async () => failed), listForUser: jest.fn(), failureReasonLabels: jest.fn(async () => sparse) };
    const svc = new PayoutService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, repo as any);
    const out = await svc.getById('t1', { userId: 'u1', canModerate: false }, 'po1');
    expect(out.failureReasonLocalized).toBe('Payment could not be completed — contact support if this repeats');
  });
});
