// modules/promotions/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every promotion/coupon/redemption read+write binds tenant_id (Law 1). No version columns → redeem
// locks rows FOR UPDATE; redemptions are guarded by ON CONFLICT; lists are keyset (never OFFSET).
import { PromotionRepository } from '../repositories/promotion.repository';
import { CouponRepository } from '../repositories/coupon.repository';
import { CouponRedemptionRepository } from '../repositories/coupon-redemption.repository';
import { Promotion, parsePromoRules } from '../domain/promotion.entity';
import { Coupon } from '../domain/coupon.entity';
import { CouponRedemption } from '../domain/coupon-redemption.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const win = { startsAt: new Date('2026-05-01T00:00:00Z'), endsAt: new Date('2026-12-31T00:00:00Z') };
const mkPromo = () => Promotion.create({ id: 'p1', tenantId: 'tenantA', promoType: 'festival', defaultName: 'X', rules: parsePromoRules({ discountType: 'percent', percentOff: 10 }), startsAt: win.startsAt, endsAt: win.endsAt });

describe('promotions tenant isolation (SQL contract)', () => {
  it('promotion.getForUpdate binds tenant_id + row-locks (no version → FOR UPDATE)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new PromotionRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'p1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['p1', 'tenantA']);
  });
  it('promotion.update is tenant-scoped, NO version clause', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new PromotionRepository(fakeReplica().provider).update(tx as any, mkPromo());
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id=\$1 AND tenant_id=\$2/); expect(sql).not.toMatch(/version/);
    expect(params[1]).toBe('tenantA');
  });
  it('promotion.listFor is keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new PromotionRepository(provider).listFor('tenantA', { limit: 20 });
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1/); expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
    expect(params[0]).toBe('tenantA');
  });

  it('coupon.getByCodeForUpdate binds tenant_id + excludes deleted + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new CouponRepository(fakeReplica().provider).getByCodeForUpdate(tx as any, 'tenantA', 'diwali10');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND code=\$2 AND deleted_at IS NULL/); expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['tenantA', 'DIWALI10']);   // code upper-cased
  });
  it('coupon.insert guards uniqueness with ON CONFLICT + binds tenant_id, no version', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const c = Coupon.create({ id: 'c1', tenantId: 'tenantA', promotionId: 'p1', code: 'X10' });
    await new CouponRepository(fakeReplica().provider).insert(tx as any, c);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO coupons/); expect(sql).toMatch(/ON CONFLICT \(tenant_id, code\) DO NOTHING/);
    expect(sql).not.toMatch(/version/); expect(params).toContain('tenantA');
  });

  it('redemption.insert binds tenant_id + ON CONFLICT(coupon_id, order_id) (idempotent)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const r = CouponRedemption.create({ id: 'r1', couponId: 'c1', tenantId: 'tenantA', userId: 'u1', orderId: 'o1', amountMinor: 5000n });
    await new CouponRedemptionRepository(fakeReplica().provider).insert(tx as any, r);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO coupon_redemptions/); expect(sql).toMatch(/ON CONFLICT \(coupon_id, order_id\) DO NOTHING/);
    expect(params).toContain('tenantA');
  });
  it('redemption.countForUser binds tenant_id + coupon + user (per-user cap)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ n: 0 }], rowCount: 1 }) };
    await new CouponRedemptionRepository(fakeReplica().provider).countForUser(tx as any, 'tenantA', 'c1', 'u1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND coupon_id=\$2 AND user_id=\$3/);
    expect(params).toEqual(['tenantA', 'c1', 'u1']);
  });
});
