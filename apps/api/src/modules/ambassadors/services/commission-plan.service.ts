// modules/ambassadors/services/commission-plan.service.ts · read the effective earning rules (resolve + list).
import { Injectable } from '@nestjs/common';
import { CommissionPlanRepository } from '../repositories/commission-plan.repository';

@Injectable()
export class CommissionPlanService {
  constructor(private readonly repo: CommissionPlanRepository) {}
  async list(tenantId: string) { return (await this.repo.listFor(tenantId)).map((p) => p.toJSON()); }
}
