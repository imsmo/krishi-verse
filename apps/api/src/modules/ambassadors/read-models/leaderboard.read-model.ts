// modules/ambassadors/read-models/leaderboard.read-model.ts · the ambassador leaderboard (PRD §16.10).
// Ranks ambassadors in the caller's tenant by total commission EARNED (bigint minor, Law 2) over an optional
// date window, with the count of earning events. Read-only, replica-backed, tenant-scoped (RLS backstop),
// bounded LIMIT. Money stays minor-unit strings over the wire. Rank assignment is a PURE helper (unit-tested):
// standard competition ranking (1,2,2,4) so ties share a place.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';

export interface LeaderboardRow { ambassadorId: string; userId: string; tierId: string | null; earnedMinor: string; events: number; rank: number; }

/** PURE: competition ranking over rows already sorted by earnedMinor DESC. Equal earnings share a rank; the
 *  next distinct value jumps by the number of tied rows (1,2,2,4). */
export function assignRanks(rows: { earnedMinor: bigint }[]): number[] {
  const ranks: number[] = [];
  let lastValue: bigint | null = null;
  let lastRank = 0;
  rows.forEach((r, i) => {
    if (lastValue === null || r.earnedMinor !== lastValue) { lastRank = i + 1; lastValue = r.earnedMinor; }
    ranks.push(lastRank);
  });
  return ranks;
}

@Injectable()
export class LeaderboardReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async top(tenantId: string, q: { periodStart?: string; periodEnd?: string; limit: number }): Promise<LeaderboardRow[]> {
    const params: unknown[] = [tenantId];
    let earnWhere = `e.tenant_id=$1`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.periodStart) earnWhere += ` AND e.created_at >= ${p(q.periodStart)}`;
    if (q.periodEnd) earnWhere += ` AND e.created_at < (${p(q.periodEnd)}::date + interval '1 day')`;
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query<any>(
      `SELECT a.id AS ambassador_id, a.user_id, a.tier_id,
              COALESCE(SUM(e.amount_minor),0)::text AS earned_minor,
              COUNT(e.id)::int AS events
         FROM ambassador_profiles a
         LEFT JOIN ambassador_earnings e ON ${earnWhere} AND e.ambassador_id = a.id
        WHERE a.tenant_id=$1 AND a.deleted_at IS NULL AND a.is_active
        GROUP BY a.id, a.user_id, a.tier_id
        ORDER BY COALESCE(SUM(e.amount_minor),0) DESC, a.id
        LIMIT ${lp}`, params);
    const ranks = assignRanks(r.rows.map((x: any) => ({ earnedMinor: BigInt(x.earned_minor) })));
    return r.rows.map((x: any, i: number) => ({
      ambassadorId: x.ambassador_id, userId: x.user_id, tierId: x.tier_id,
      earnedMinor: x.earned_minor, events: x.events, rank: ranks[i],
    }));
  }
}
