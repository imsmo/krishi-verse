// modules/schemes/services/scheme.service.ts · read-only scheme catalogue + the eligibility checker.
// Global reference data (admin-authored, Law 11). The eligibility check is a pure, explainable evaluation
// of the applicant's attributes against the scheme's machine-readable rules — no AI, no side effects.
import { Injectable } from '@nestjs/common';
import { SchemeRepository } from '../repositories/scheme.repository';
import { SchemeAuthorityRepository } from '../repositories/scheme-authority.repository';
import { ApplicantProfile } from '../domain/schemes.events';
import { SchemeNotFoundError } from '../domain/schemes.errors';

@Injectable()
export class SchemeService {
  constructor(private readonly schemes: SchemeRepository, private readonly authorities: SchemeAuthorityRepository) {}
  async listAuthorities(tenantId: string, level?: string) { return (await this.authorities.list(tenantId, level)).map((a) => a.toJSON()); }
  async list(tenantId: string, q: { categoryId?: string; activeOnly: boolean }) { return (await this.schemes.list(tenantId, q)).map((s) => s.toJSON()); }
  async getById(tenantId: string, id: string) { const s = await this.schemes.getById(tenantId, id); if (!s) throw new SchemeNotFoundError(id); return s.toJSON(); }
  async checkEligibility(tenantId: string, id: string, profile: ApplicantProfile) {
    const s = await this.schemes.getById(tenantId, id); if (!s) throw new SchemeNotFoundError(id);
    return { schemeId: s.id, schemeVersion: s.version, ...s.evaluate(profile) };
  }
}
