// modules/payments/__tests__/payout-kyc-gate.spec.ts · S3 review-mandated fix.
// Finding: PayoutService.requestPayout had NO kyc_status check anywhere in modules/payments — an
// unapproved self-serve farmer (kyc_status='none' straight off POST /v1/onboarding/roles) could reach
// the wallet debit. Fix: assert the caller has kyc_status='verified' on ANY active role in this tenant
// (payout is user-level, not role-specific) BEFORE any debit/ledger work; 'none'/'pending'/'rejected'/
// 'expired' all fail closed with a generic KycRequiredError (403, no enumeration of which status the
// caller is actually in).
//
// Unit-level with mocked collaborators — mirrors the harness pattern in payout-failure-reason.spec.ts
// (no real DB needed; PayoutRepository.callerKycVerified's SQL — kyc_status='verified' AND is_active=true
// — is itself pinned by its own doc-comment and exercised for real in the *.integration.spec.ts suite).
import { PayoutService } from '../services/payout.service';
import { KycRequiredError } from '../domain/payments.errors';

type Kyc = 'none' | 'pending' | 'verified' | 'rejected' | 'expired';

function harness(kyc: Kyc) {
  const tx = { query: jest.fn(), tenantId: 't1', userId: 'u1' };
  const uow = { run: jest.fn((_tenantId: string, fn: (tx: any) => any) => fn(tx)) };
  const outbox = { write: jest.fn(async () => undefined) };
  const idem = { remember: jest.fn((_key: string, _userId: string, _name: string, fn: () => any) => fn()) };
  const metrics = { observe: jest.fn(), inc: jest.fn() };
  const wallet = { post: jest.fn(async () => ({ txnId: 'txn1' })) };
  const gateway = {};
  const audit = { write: jest.fn(async () => undefined) };
  const repo = {
    // mirrors PayoutRepository.callerKycVerified's SQL: only 'verified' + active satisfies the gate
    callerKycVerified: jest.fn(async () => kyc === 'verified'),
    bankAccountBelongsTo: jest.fn(async () => true),
    resolvePurposeId: jest.fn(async () => 'purpose1'),
    insertIdempotent: jest.fn(async () => ({ id: 'po1', replayed: false })),
  };
  const svc = new PayoutService(uow as any, outbox as any, idem as any, metrics as any, wallet as any, gateway as any, audit as any, repo as any);
  return { svc, repo, wallet, outbox, audit };
}

const dto = { amountMinor: '10000', bankAccountId: 'b1', purpose: 'settlement' as const, currencyCode: 'INR' };

describe('PayoutService.requestPayout — KYC gate (S3 review finding)', () => {
  it.each(['none', 'pending', 'rejected', 'expired'] as Kyc[])(
    'kyc_status=%s → 403 KycRequiredError, no money moves',
    async (kyc) => {
      const h = harness(kyc);
      await expect(h.svc.requestPayout('t1', 'u1', 'idem-1', dto)).rejects.toThrow(KycRequiredError);

      // the gate runs BEFORE any other work in the tx — no bank-account check, no debit, no
      // outbox/audit write should ever happen for an unverified caller.
      expect(h.repo.bankAccountBelongsTo).not.toHaveBeenCalled();
      expect(h.wallet.post).not.toHaveBeenCalled();
      expect(h.outbox.write).not.toHaveBeenCalled();
      expect(h.audit.write).not.toHaveBeenCalled();
    },
  );

  it('kyc_status=verified → proceeds to reserve funds and queue the payout', async () => {
    const h = harness('verified');
    const out = await h.svc.requestPayout('t1', 'u1', 'idem-2', dto);
    expect(out).toMatchObject({ payoutId: expect.any(String), status: 'queued', amountMinor: '10000' });
    expect(h.repo.bankAccountBelongsTo).toHaveBeenCalled();
    expect(h.wallet.post).toHaveBeenCalled();
    expect(h.outbox.write).toHaveBeenCalled();
    expect(h.audit.write).toHaveBeenCalled();
  });

  it('the error is user-safe: stable code, 403, and never echoes back the actual kyc_status', async () => {
    const h = harness('rejected');
    try {
      await h.svc.requestPayout('t1', 'u1', 'idem-3', dto);
      throw new Error('expected requestPayout to throw');
    } catch (e) {
      const err = e as KycRequiredError;
      expect(err).toBeInstanceOf(KycRequiredError);
      expect(err.code).toBe('KYC_REQUIRED');
      expect(err.httpStatus).toBe(403);
      expect(err.message.toLowerCase()).not.toMatch(/none|pending|rejected|expired/);
      expect(err.details ?? {}).toEqual({});
    }
  });
});
