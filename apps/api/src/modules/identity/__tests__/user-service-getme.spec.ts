// modules/identity/__tests__/user-service-getme.spec.ts · S6-prep contract fix: GET /v1/users/me
// now carries the caller's ACTIVE role codes (the mobile app's UserProfile always assumed a `roles`
// field; its absence crashed AuthProvider — see auth.store loadProfile normalization on the client).
// No DB: mocked repos, mirroring onboarding.spec.ts's harness style.
import { UserService } from '../services/user.service';
import { User } from '../domain/user.entity';

function makeUser() {
  return User.rehydrate({
    id: 'u1', phone: '+919876500001', phoneVerified: true, fullName: 'Ramesh Patel',
    languageCode: 'hi', countryCode: 'IN', status: 'active', isTest: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
}

function svc(listRows: any[]) {
  const uow: any = { run: jest.fn() };
  const outbox: any = { write: jest.fn() };
  const audit: any = { write: jest.fn() };
  const users: any = { findById: jest.fn().mockResolvedValue(makeUser()) };
  const utr: any = { list: jest.fn().mockResolvedValue(listRows) };
  return { service: new UserService(uow, outbox, audit, users, utr), users, utr };
}

describe('UserService.getMe (S6-prep)', () => {
  it('enriches the self-read with ACTIVE role codes only (inactive/pending never leak)', async () => {
    const { service } = svc([
      { role_code: 'farmer', is_active: true },
      { role_code: 'customer', is_active: true },
      { role_code: 'vyapari', is_active: false },
    ]);
    const me = await service.getMe('t1', 'u1');
    expect(me.roles).toEqual(['farmer', 'customer']);
    expect((me as any).phone).toBeDefined();   // base toPublic() fields still present (additive)
  });

  it('roles is [] for a fresh user with no grants — never undefined (the mobile crash class)', async () => {
    const { service } = svc([]);
    const me = await service.getMe('t1', 'u1');
    expect(me.roles).toEqual([]);
  });
});
