// modules/identity/services/permission.service.ts · permission catalogue reads.
import { Injectable } from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository';

@Injectable()
export class PermissionService {
  constructor(private readonly perms: PermissionRepository) {}
  async list(tenantId: string, moduleCode?: string) {
    return (await this.perms.list(tenantId, moduleCode)).map((p) => p.props);
  }
}
