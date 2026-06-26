// modules/assistant/repositories/assistant.repository.ts · ai_inferences access for the governed assistant.
// The assistant's consequential decision (the farmer-facing answer) is logged to the append-only ai_inferences
// (db/migrations/0013) as subject_type='assistant_message', input_ref pointers ONLY (never the raw message/PII):
// we store { u: userId, lang, blocked?, degraded? }. The per-user cost/rate windows are COUNTED off the same
// table on the replica (CQRS), so the cap source and the audit are one and the same — no extra schema.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

const SUBJECT = 'assistant_message';

export interface AssistantInferenceInsert {
  tenantId: string | null;
  modelId: string | null;            // registry model id when a real model ran; null when degraded/blocked
  subjectId: string;                 // a per-message uuid (the inference subject)
  inputRef: Record<string, unknown>; // POINTERS ONLY (userId, lang, flags) — never the message text
  output: Record<string, unknown>;   // governed result summary (status, needsReview, citation count) — never PII
  confidence: number | null;
}

@Injectable()
export class AssistantRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Insert the inference row inside the caller's tx (atomic with the audit row). */
  async insert(tx: TxContext, rec: AssistantInferenceInsert): Promise<void> {
    await tx.query(
      `INSERT INTO ai_inferences (tenant_id, model_id, subject_type, subject_id, input_ref, output, confidence, was_overridden, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, false, now())`,
      [rec.tenantId, rec.modelId, SUBJECT, rec.subjectId, JSON.stringify(rec.inputRef), JSON.stringify(rec.output), rec.confidence],
    );
  }

  /** Count this user's assistant messages since `sinceIso` (replica, tenant-scoped via RLS). Capped scan window. */
  async countSince(tenantId: string, userId: string, sinceIso: string): Promise<number> {
    const r = await this.replica.forTenant(tenantId).query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ai_inferences
       WHERE tenant_id = $1 AND subject_type = $2 AND input_ref->>'u' = $3 AND created_at >= $4`,
      [tenantId, SUBJECT, userId, sinceIso],
    );
    return Number(r.rows[0]?.n ?? '0');
  }
}
