// modules/identity/repositories/session.repository.ts · auth sessions (only refresh HASH stored).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Session } from '../domain/session.entity';

const COLS = `id, user_id, device_id, refresh_token_hash, host(ip) AS ip, expires_at, revoked_at, last_seen_at`;
const toDomain = (r: any): Session => Session.rehydrate({ id: r.id, userId: r.user_id, deviceId: r.device_id, refreshTokenHash: r.refresh_token_hash, ip: r.ip, expiresAt: r.expires_at, revokedAt: r.revoked_at, lastSeenAt: r.last_seen_at });

@Injectable()
export class SessionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, s: Session): Promise<void> {
    const p = s.toProps();
    await tx.query(
      `INSERT INTO sessions (id, user_id, device_id, refresh_token_hash, ip, expires_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5::inet,$6, now())`,
      [p.id, p.userId, p.deviceId, p.refreshTokenHash, p.ip, p.expiresAt]);
  }
  async getByRefreshHashForUpdate(tx: TxContext, hash: string): Promise<Session | null> {
    const r = await tx.query(`SELECT ${COLS} FROM sessions WHERE refresh_token_hash=$1 FOR UPDATE`, [hash]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async rotate(tx: TxContext, s: Session): Promise<void> {
    const p = s.toProps();
    await tx.query(`UPDATE sessions SET refresh_token_hash=$2, expires_at=$3, last_seen_at=now() WHERE id=$1`, [p.id, p.refreshTokenHash, p.expiresAt]);
  }
  async revoke(tx: TxContext, sessionId: string, userId: string): Promise<void> {
    await tx.query(`UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`, [sessionId, userId]);
  }
  async revokeAllForUser(tx: TxContext, userId: string): Promise<void> {
    await tx.query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
  }
  async listForUser(tenantId: string, userId: string): Promise<any[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, device_id, host(ip) AS ip, expires_at, revoked_at, last_seen_at, created_at
         FROM sessions WHERE user_id=$1 ORDER BY last_seen_at DESC LIMIT 50`, [userId]);
    return r.rows;
  }
}
