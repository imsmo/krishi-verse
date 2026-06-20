// modules/traceability/jobs/anchor-hashes.job.ts · the worker's tamper-anchor runner.
// Connected as the BYPASSRLS relay role, it stamps each un-anchored lot's blockchain_anchor with the head of its
// event hash-chain (the latest event_hash) — a cheap, verifiable anchor (Phase 2/3 may push this hash on-chain).
// Bounded per run; idempotent (only fills NULL anchors for lots that have ≥1 event).
import type { Pool } from 'pg';

export interface AnchorResult { anchored: number; }

export async function runAnchorHashes(relayPool: Pool, max = 500): Promise<AnchorResult> {
  const r = await relayPool.query(
    `UPDATE trace_lots l SET blockchain_anchor = e.event_hash, updated_at = now()
       FROM (SELECT DISTINCT ON (trace_lot_id) trace_lot_id, event_hash FROM trace_events ORDER BY trace_lot_id, created_at DESC, id DESC) e
      WHERE l.id = e.trace_lot_id AND l.blockchain_anchor IS NULL AND l.deleted_at IS NULL
        AND l.id IN (SELECT id FROM trace_lots WHERE blockchain_anchor IS NULL AND deleted_at IS NULL ORDER BY created_at LIMIT $1)`, [max]);
  return { anchored: r.rowCount ?? 0 };
}
