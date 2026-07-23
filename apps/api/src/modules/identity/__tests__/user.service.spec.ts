// modules/identity/__tests__/user.service.spec.ts · value-object validation (address, bank, dsr).
import { Address } from '../domain/address.entity';
import { BankAccount } from '../domain/bank-account.entity';
import { DataSubjectRequest } from '../domain/data-subject-request.entity';

describe('Address', () => {
  it('requires a line1 and validates pincode', () => {
    expect(() => Address.create({ id: 'a', userId: 'u', tenantId: null, labelId: null, line1: 'x', line2: null, village: null, regionId: null, pincode: null, countryCode: 'IN', lat: null, lng: null, contactName: null, contactPhone: null })).toThrow();
    const ok = Address.create({ id: 'a', userId: 'u', tenantId: null, labelId: null, line1: 'Plot 4, Main Rd', line2: null, village: null, regionId: null, pincode: '362001', countryCode: 'IN', lat: null, lng: null, contactName: null, contactPhone: null });
    expect(ok.toProps().pincode).toBe('362001');
  });
});

describe('BankAccount', () => {
  it('requires vault_ref and a valid IFSC for bank; masks on toPublic', () => {
    expect(() => BankAccount.create({ id: 'b', userId: 'u', tenantId: null, accountKind: 'bank', upiId: null, accountLast4: '1234', ifsc: 'BADIFSC', holderName: 'R', vaultRef: 'vault://x' })).toThrow();
    const b = BankAccount.create({ id: 'b', userId: 'u', tenantId: null, accountKind: 'bank', upiId: null, accountLast4: '1234', ifsc: 'HDFC0001234', holderName: 'R', vaultRef: 'vault://x' });
    const pub = JSON.stringify(b.toPublic());
    expect(pub).not.toContain('vault://'); // token never serialized
    expect(b.toPublic().last4).toBe('1234');
  });
  it('requires upi_id for UPI kind', () => {
    expect(() => BankAccount.create({ id: 'b', userId: 'u', tenantId: null, accountKind: 'upi', upiId: null, accountLast4: null, ifsc: null, holderName: null, vaultRef: 'vault://x' })).toThrow();
  });
});

describe('DataSubjectRequest', () => {
  it('erasure gets a 90-day cooling window; transitions are guarded', () => {
    const dsr = DataSubjectRequest.open({ id: 'd', userId: 'u', requestType: 'erasure' });
    expect(dsr.toProps().coolingEndsAt).not.toBeNull();
    dsr.transition('in_progress'); dsr.transition('completed');
    expect(() => dsr.transition('open')).toThrow(); // terminal
  });

});
