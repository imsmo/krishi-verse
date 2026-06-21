// apps/admin-api/src/modules/support-oversight/services/tenant-health-alerts.service.ts · READ-ONLY per-tenant
// support-health rollup: open ticket count, SLA-breached count, P0-open count, and the oldest open ticket's age.
// With a tenantId ⇒ that tenant's rollup; without ⇒ the top tenants by open SLA breaches (the alert list). Bounded;
// no writes.
import { Injectable } from '@nestjs/common';
import { SupportOversightRepository } from '../repositories/support-oversight.repository';
import { TenantHealthDto } from '../dto/support-oversight.dto';

@Injectable()
export class TenantHealthAlertsService {
  constructor(private readonly repo: SupportOversightRepository) {}

  async health(dto: TenantHealthDto) {
    const rows = await this.repo.tenantHealth(dto.tenantId, dto.limit);
    return { items: rows };
  }
}
