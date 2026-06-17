// modules/catalogue/__tests__/product.entity.spec.ts · product invariants + lifecycle.
import { Product } from '../domain/product.entity';
import { InvalidProductError } from '../domain/catalogue.errors';

const base = { id: 'p1', categoryId: 'c1', code: null, defaultName: 'Wheat HD-2967', brandId: null, defaultUnit: 'quintal', gstRatePct: 0, hsnCode: '1001', isPerishable: false, shelfLifeDays: null, tenantId: 't1' };

describe('Product aggregate', () => {
  it('creates a tenant-private product and emits product_created', () => {
    const p = Product.create({ ...base });
    expect(p.tenantId).toBe('t1');
    expect(p.isActive).toBe(true);
    expect(p.pullEvents().map((e) => e.type)).toContain('catalogue.product_created');
  });
  it('rejects missing name/category/unit and bad gst', () => {
    expect(() => Product.create({ ...base, defaultName: 'x' })).toThrow(InvalidProductError);
    expect(() => Product.create({ ...base, categoryId: '' })).toThrow(InvalidProductError);
    expect(() => Product.create({ ...base, defaultUnit: '' })).toThrow(InvalidProductError);
    expect(() => Product.create({ ...base, gstRatePct: 200 })).toThrow(InvalidProductError);
  });
  it('deactivate is idempotent and emits once', () => {
    const p = Product.create({ ...base }); p.pullEvents();
    p.deactivate(); expect(p.isActive).toBe(false);
    expect(p.pullEvents().map((e) => e.type)).toContain('catalogue.product_deactivated');
    p.deactivate(); expect(p.pullEvents()).toHaveLength(0); // no-op second time
  });
});
