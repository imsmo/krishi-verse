// modules/education/repositories/instructor.repository.ts · instructors. tenant_id in every tenant query (Law 1)
// + RLS (NULL tenant = platform instructor, read-only here). A user has at most one instructor row per tenant.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Instructor } from '../domain/instructor.entity';

const COLS = `id, user_id, tenant_id, bio, royalty_bps, is_verified, created_at`;
function toDomain(r: any): Instructor {
  return Instructor.rehydrate({ id: r.id, userId: r.user_id, tenantId: r.tenant_id, bio: r.bio, royaltyBps: r.royalty_bps, isVerified: r.is_verified, createdAt: r.created_at });
}
@Injectable()
export class InstructorRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, i: Instructor, tenantId: string): Promise<void> {
    const p = i.toProps();
    await tx.query(`INSERT INTO instructors (id, user_id, tenant_id, bio, royalty_bps, is_verified, created_by) VALUES ($1,$2,$3,$4,$5,$6,$2)`,
      [p.id, p.userId, tenantId, p.bio, p.royaltyBps, p.isVerified]);
  }
  async update(tx: TxContext, i: Instructor, tenantId: string): Promise<void> {
    const p = i.toProps();
    await tx.query(`UPDATE instructors SET bio=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, tenantId, p.bio]);
  }
  async findByUser(tenantId: string, userId: string, tx?: TxContext): Promise<Instructor | null> {
    const sql = `SELECT ${COLS} FROM instructors WHERE user_id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [userId, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [userId, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<Instructor | null> {
    // visible: the tenant's own instructor OR a platform instructor (tenant_id IS NULL)
    const sql = `SELECT ${COLS} FROM instructors WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL) AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
}
