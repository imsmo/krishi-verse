// modules/identity/__tests__/bank-account-kyc-gate.spec.ts · KV-BL-067 follow-up.
// Finding (S3 review, mirrored on the identity side): BankAccountService.add / addFullBankAccount
// added a NEW payout destination with no KYC check anywhere in modules/identity — an unapproved
// self-serve caller (kyc_status='none'/'pending'/'rejected'/'expired' on every active role in this
// tenant) could register a bank account or tokenise a raw one. Fix: gate both paths on
// UserTenantRoleRepository.callerKycVerified (mirrors payments' PayoutRepository.callerKycVerified)
// BEFORE any side effect — including the gateway tokenise call in addFullBankAccount, which mints a
// real vault token upstream and must never fire for an unverified caller.
//
// Unit-level with mocked collaborators — mirrors modules/payments/__tests__/payout-kyc-gate.spec.ts.
import { BankAccountService } from '../services/bank-account.service';
import { BankAccountKycRequiredError } from '../domain/identity.errors';

type Kyc = 'none' | 'pending' | 'verified' | 'rejected' | 'expired';

function harness(kyc: Kyc) {
  const tx = { query: jest.fn(), tenantId: 't1', userId: 'u1' };
  const uow = { run: jest.fn((_tenantId: string, fn: (tx: any) => any) => fn(tx)) };
  const tokeniser = { tokeniseBank: jest.fn(async () => ({ vaultRef: 'vault1', last4: '1234' })), providerCode: 'razorpayx' };
  const audit = { write: jest.fn(async () => undefined) };
  const repo = {
    unsetPrimary: jest.fn(async () => undefined),
    insert: jest.fn(async () => undefined),
    listByUser: jest.fn(async () => []),
  };
  const utr = {
    // mirrors UserTenantRoleRepository.callerKycVerified's SQL: only 'verified' + active satisfies the gate
    callerKycVerified: jest.fn(async () => kyc === 'verified'),
  };
  const svc = new BankAccountService(uow as any, tokeniser as any, audit as any, repo as any, utr as any);
  return { svc, repo, tokeniser, audit, utr };
}

const addDto = { accountKind: 'upi' as const, upiId: 'farmer@upi', vaultRef: 'vault-existing', isPrimary: false };
const tokeniseDto = { accountNumber: '123456789012', ifsc: 'HDFC0001234', holderName: 'A Farmer', isPrimary: false };

describe('BankAccountService.add — KYC gate (KV-BL-067 follow-up)', () => {
  it.each(['none', 'pending', 'rejected', 'expired'] as Kyc[])(
    'kyc_status=%s → 403 BankAccountKycRequiredError, no side effects',
    async (kyc) => {
      const h = harness(kyc);
      await expect(h.svc.add('t1', 'u1', addDto)).rejects.toThrow(BankAccountKycRequiredError);
      expect(h.repo.unsetPrimary).not.toHaveBeenCalled();
      expect(h.repo.insert).not.toHaveBeenCalled();
    },
  );

  it('kyc_status=verified → proceeds and inserts the bank account', async () => {
    const h = harness('verified');
    const out = await h.svc.add('t1', 'u1', addDto);
    expect(out).toMatchObject({ id: expect.any(String) });
    expect(h.repo.insert).toHaveBeenCalled();
  });
});

describe('BankAccountService.addFullBankAccount — KYC gate (KV-BL-067 follow-up)', () => {
  it.each(['none', 'pending', 'rejected', 'expired'] as Kyc[])(
    'kyc_status=%s → 403 BankAccountKycRequiredError, gateway is NEVER called',
    async (kyc) => {
      const h = harness(kyc);
      await expect(h.svc.addFullBankAccount('t1', 'u1', tokeniseDto)).rejects.toThrow(BankAccountKycRequiredError);

      // the gate runs BEFORE the tokenise call — an unverified caller must never reach the gateway,
      // never mind the DB insert / audit write.
      expect(h.tokeniser.tokeniseBank).not.toHaveBeenCalled();
      expect(h.repo.insert).not.toHaveBeenCalled();
      expect(h.audit.write).not.toHaveBeenCalled();
    },
  );

  it('kyc_status=verified → proceeds to tokenise and persist', async () => {
    const h = harness('verified');
    const out = await h.svc.addFullBankAccount('t1', 'u1', tokeniseDto);
    expect(out).toMatchObject({ id: expect.any(String) });
    expect(h.tokeniser.tokeniseBank).toHaveBeenCalled();
    expect(h.repo.insert).toHaveBeenCalled();
    expect(h.audit.write).toHaveBeenCalled();
  });

  it('the error is user-safe: stable code, 403, and never echoes back the actual kyc_status', async () => {
    const h = harness('rejected');
    try {
      await h.svc.addFullBankAccount('t1', 'u1', tokeniseDto);
      throw new Error('expected addFullBankAccount to throw');
    } catch (e) {
      const err = e as BankAccountKycRequiredError;
      expect(err).toBeInstanceOf(BankAccountKycRequiredError);
      expect(err.code).toBe('BANK_ACCOUNT_KYC_REQUIRED');
      expect(err.httpStatus).toBe(403);
      expect(err.message.toLowerCase()).not.toMatch(/none|pending|rejected|expired/);
      expect(err.details ?? {}).toEqual({});
    }
  });
});
