// modules/exports/services/compliance-requirement.service.ts · read-only compliance-rule browse.
// Global reference data (authored on the admin/platform surface, Law 11); here exporters just look it up.
import { Injectable } from '@nestjs/common';
import { ComplianceRequirementRepository } from '../repositories/compliance-requirement.repository';

@Injectable()
export class ComplianceRequirementService {
  constructor(private readonly repo: ComplianceRequirementRepository) {}
  async list(tenantId: string, destinationCountry: string, categoryId?: string) {
    return (await this.repo.listInEffect(tenantId, destinationCountry, categoryId)).map((c) => c.toJSON());
  }
}
