// apps/admin-api/src/modules/tenant-ops/services/tenant-scorecard.service.ts · read-only health rollup for ONE
// tenant: lifecycle status + risk score, current subscription (price as STRING minor units — Law 2), live
// listing count, open-dispute count, active limit overrides. Single batched read (no N+1). Money never floated.
import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantNotFoundError } from '../domain/tenant-ops.errors';

@Injectable()
export class TenantScorecardService {
  constructor(private readonly repo: TenantRepository) {}

  async scorecard(id: string) {
    const card = await this.repo.scorecard(id);
    if (!card) throw new TenantNotFoundError(id);     // 404 (not 403) — no cross-realm enumeration signal
    return card;
  }
}
