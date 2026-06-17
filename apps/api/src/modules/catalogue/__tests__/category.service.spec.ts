// modules/catalogue/__tests__/category.service.spec.ts · Category read-model shape.
import { Category } from '../domain/category.entity';
describe('Category', () => {
  it('exposes id + isActive from props', () => {
    const c = new Category({ id: 'c1', parentId: null, code: 'crops', defaultName: 'Crops', path: 'crops', depth: 1, commerceKind: 'goods', requiresLicense: false, requiresCertificate: false, minAge: null, isActive: true, sortOrder: 1 });
    expect(c.id).toBe('c1'); expect(c.isActive).toBe(true);
  });
});
