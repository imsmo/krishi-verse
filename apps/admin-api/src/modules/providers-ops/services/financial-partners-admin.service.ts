// apps/admin-api/src/modules/providers-ops/services/financial-partners-admin.service.ts · READ-ONLY focused lens on
// the money-path providers — the FINANCIAL categories (payment gateways + KYC: Razorpay/RazorpayX/PFMS/…). The
// finance ops team watches these specifically (an outage here halts settlements/onboarding). Returns each
// financial provider with its registry status + credential-ref coverage counts; never any secret material.
import { Injectable } from '@nestjs/common';
import { ProvidersRepository } from '../repositories/providers.repository';
import { FINANCIAL_CATEGORIES } from '../domain/category';

@Injectable()
export class FinancialPartnersAdminService {
  constructor(private readonly repo: ProvidersRepository) {}

  async list() {
    const [providers, health] = await Promise.all([this.repo.listByCategories(FINANCIAL_CATEGORIES), this.repo.credentialHealthAll()]);
    const items = providers.map((p) => {
      const j = p.toJSON();
      return { ...j, health: health[p.code] ?? { configuredTenants: 0, activeTenants: 0 }, degraded: !j.isActive && (health[p.code]?.configuredTenants ?? 0) > 0 };
    });
    return { items };
  }
}
