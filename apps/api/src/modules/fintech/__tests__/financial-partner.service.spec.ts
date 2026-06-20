// modules/fintech/__tests__/financial-partner.service.spec.ts · FinancialPartnerService unit tests (fakes).
// Pins the read-only browse + typed 404s for missing partner/product (global reference data).
import { FinancialPartnerService } from '../services/financial-partner.service';
import { PartnerNotFoundError, LoanProductNotFoundError } from '../domain/fintech.errors';

function harness() {
  const partners = { list: jest.fn(async () => []), getById: jest.fn(async () => null) };
  const products = { list: jest.fn(async () => []), getById: jest.fn(async () => null) };
  return { svc: new FinancialPartnerService(partners as any, products as any), partners, products };
}

describe('FinancialPartnerService browse', () => {
  it('lists partners + products (read-only)', async () => {
    const { svc, partners, products } = harness();
    await svc.listPartners('t1', { activeOnly: true }); expect(partners.list).toHaveBeenCalled();
    await svc.listProducts('t1', { activeOnly: true }); expect(products.list).toHaveBeenCalled();
  });
  it('throws typed 404s for missing partner / product', async () => {
    const { svc } = harness();
    await expect(svc.getPartner('t1', 'x')).rejects.toBeInstanceOf(PartnerNotFoundError);
    await expect(svc.getProduct('t1', 'x')).rejects.toBeInstanceOf(LoanProductNotFoundError);
  });
});
