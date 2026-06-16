// modules/identity/services/role.service.ts · role catalogue reads.
import { Injectable } from '@nestjs/common';
import { RoleRepository } from '../repositories/role.repository';
import { QueryRoleDto } from '../dto/query-role.dto';

@Injectable()
export class RoleService {
  constructor(private readonly roles: RoleRepository) {}
  async list(tenantId: string, q: QueryRoleDto) {
    const rows = await this.roles.list(tenantId, { scope: q.scope, activeOnly: q.activeOnly });
    return rows.map((r) => r.props);
  }
}
