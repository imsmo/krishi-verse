// modules/identity/repositories/permission.repository.ts · permission catalogue reads.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { Permission } from '../domain/permission.entity';

@Injectable()
export class PermissionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async list(tenantId: string, moduleCode?: string): Promise<Permission[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT code, default_name, module_code FROM permissions WHERE ($1::text IS NULL OR module_code=$1) ORDER BY code`,
      [moduleCode ?? null]);
    return r.rows.map((x) => new Permission({ code: x.code, defaultName: x.default_name, moduleCode: x.module_code }));
  }
}
