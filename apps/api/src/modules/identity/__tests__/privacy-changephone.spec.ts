// modules/identity/__tests__/privacy-changephone.spec.ts · pure-domain unit tests for API-W12.
// DPDP DSR cooling-off (erasure carries 90 days; export does not) + User.changePhone invariants + saved 'tip' type.
import { DataSubjectRequest } from '../domain/data-subject-request.entity';
import { User } from '../domain/user.entity';
import { InvalidPhoneError } from '../domain/identity.errors';
import { SAVED_ENTITY_TYPES, assertSavedEntityType } from '../../buyer/domain/saved-item.entity';

describe('DataSubjectRequest.open — DPDP cooling-off', () => {
  it('erasure sets a ~90-day cooling window', () => {
    const d = DataSubjectRequest.open({ id: 'd1', userId: 'u1', requestType: 'erasure' });
    const ends = d.toProps().coolingEndsAt!;
    const days = Math.round((ends.getTime() - Date.now()) / 86400_000);
    expect(d.toProps().status).toBe('open');
    expect(days).toBe(90);
  });
  it('portability (export) has no cooling window', () => {
    const d = DataSubjectRequest.open({ id: 'd2', userId: 'u1', requestType: 'portability' });
    expect(d.toProps().coolingEndsAt).toBeNull();
  });
});

describe('User.changePhone', () => {
  const make = () => User.register({ id: 'u1', phone: '+919800000001' });
  it('swaps the phone + emits identity.phone_changed (masked, no raw PII)', () => {
    const u = make(); u.pullEvents();
    u.changePhone('+919800000002');
    expect(u.phone).toBe('+919800000002');
    const ev = u.pullEvents().find((e) => e.type === 'identity.phone_changed');
    expect(ev).toBeTruthy();
    expect(JSON.stringify(ev!.payload)).not.toContain('9800000002');   // only masked forms in the event
  });
  it('rejects an invalid E.164 number', () => { expect(() => make().changePhone('123')).toThrow(InvalidPhoneError); });
  it('is a no-op (no event) when the number is unchanged', () => {
    const u = make(); u.pullEvents();
    u.changePhone('+919800000001');
    expect(u.pullEvents()).toHaveLength(0);
  });
});

describe('saved entity types — tip wishlist', () => {
  it("'tip' is now an allowed saved entity type", () => {
    expect(SAVED_ENTITY_TYPES).toContain('tip');
    expect(assertSavedEntityType('tip')).toBe('tip');
  });
});
