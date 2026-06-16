// modules/identity/__tests__/user.entity.spec.ts · user invariants, status machine, PII masking.
import { User } from '../domain/user.entity';
import { InvalidPhoneError, IllegalUserTransitionError, UnderageError } from '../domain/identity.errors';

const reg = () => User.register({ id: 'u1', phone: '+919876543210', fullName: 'Ramesh' });

describe('User aggregate', () => {
  it('registers a valid E.164 phone, emits user_registered, is loginable', () => {
    const u = reg();
    expect(u.status).toBe('active');
    expect(u.isLoginable).toBe(true);
    expect(u.pullEvents().map((e) => e.type)).toContain('identity.user_registered');
  });
  it('rejects a non-E.164 phone', () => {
    expect(() => User.register({ id: 'u', phone: '98765' })).toThrow(InvalidPhoneError);
  });
  it('toPublic() masks phone and never leaks vault refs', () => {
    const u = reg(); u.setAadhaarVault('1234', 'vault://abc'); u.setPanVault('vault://pan');
    const pub = u.toPublic() as any;
    expect(pub.phone).toMatch(/\*\*\*\*/);
    expect(pub.hasAadhaar).toBe(true);
    expect(JSON.stringify(pub)).not.toContain('vault://'); // refs never serialized
  });
  it('enforces the status state machine', () => {
    const u = reg();
    u.changeStatus('suspended'); expect(u.status).toBe('suspended');
    u.changeStatus('active');    expect(u.status).toBe('active');
    u.changeStatus('soft_deleted');
    expect(() => u.changeStatus('active')).toThrow(IllegalUserTransitionError); // terminal
  });
  it('age gate rejects under-18 for adult roles', () => {
    const u = reg(); u.updateProfile({ dob: '2015-01-01' });
    expect(() => u.assertMinAge(18)).toThrow(UnderageError);
    const adult = reg(); adult.updateProfile({ dob: '1990-01-01' });
    expect(() => adult.assertMinAge(18)).not.toThrow();
  });
});
