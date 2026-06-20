// modules/fintech/services/financial-partner.service.ts · read-only lender + loan-product browse.
// Global reference data (admin/platform-authored, Law 11); here borrowers shop for a product.
import { Injectable } from '@nestjs/common';
import { FinancialPartnerRepository } from '../repositories/financial-partner.repository';
import { LoanProductRepository } from '../repositories/loan-product.repository';
import { PartnerNotFoundError, LoanProductNotFoundError } from '../domain/fintech.errors';

@Injectable()
export class FinancialPartnerService {
  constructor(private readonly partners: FinancialPartnerRepository, private readonly products: LoanProductRepository) {}
  async listPartners(tenantId: string, q: { partnerKind?: string; activeOnly: boolean }) { return (await this.partners.list(tenantId, q)).map((p) => p.toJSON()); }
  async getPartner(tenantId: string, id: string) { const p = await this.partners.getById(tenantId, id); if (!p) throw new PartnerNotFoundError(id); return p.toJSON(); }
  async listProducts(tenantId: string, q: { partnerId?: string; activeOnly: boolean }) { return (await this.products.list(tenantId, q)).map((p) => p.toJSON()); }
  async getProduct(tenantId: string, id: string) { const p = await this.products.getById(tenantId, id); if (!p) throw new LoanProductNotFoundError(id); return p.toJSON(); }
}
