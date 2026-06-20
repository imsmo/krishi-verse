// modules/schemes/repositories/scheme-authority.repository.ts · READ-ONLY scheme_authorities (global ref).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { SchemeAuthority } from '../domain/scheme-authority.entity';
const toDomain = (r: any) => SchemeAuthority.rehydrate({ id: r.id, defaultName: r.default_name, level: r.level, regionId: r.region_id, createdAt: r.created_at });
@Injectable()
export class SchemeAuthorityRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async list(tenantId: string, level?: string): Promise<SchemeAuthority[]> {
    const params: unknown[] = []; let where = `deleted_at IS NULL`;
    if (level) { params.push(level); where += ` AND level=$1`; }
    const r = await this.replica.forTenant(tenantId).query(`SELECT id, default_name, level, region_id, created_at FROM scheme_authorities WHERE ${where} ORDER BY default_name LIMIT 200`, params);
    return r.rows.map(toDomain);
  }
}
