// modules/tenant-webhooks/repositories/webhook.repository.ts · SQL for webhook_endpoints + webhook_deliveries (0002).
// tenant_id in EVERY tenant query (Law 1) + RLS. secret_hash holds the ENCRYPTED signing secret (never selected
// into a wire shape). Endpoint reads on the replica; the fanout enqueue + the delivery-claim run inside a tx.
import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { WebhookEndpoint } from '../domain/webhook-endpoint.entity';

@Injectable()
export class WebhookRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async listForTenant(tenantId: string, limit = 100): Promise<WebhookEndpoint[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, tenant_id, url, secret_hash, event_types, is_active, created_at
         FROM webhook_endpoints WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`, [tenantId, limit]);
    return r.rows.map((x: any) => new WebhookEndpoint({
      id: x.id, tenantId: x.tenant_id, url: x.url, secretEnc: x.secret_hash,
      eventTypes: x.event_types ?? [], isActive: x.is_active,
      createdAt: x.created_at ? new Date(x.created_at).toISOString() : null,
    }));
  }

  async insert(tx: TxContext, tenantId: string, url: string, secretEnc: string, eventTypes: string[]): Promise<string> {
    const id = uuidv7();
    await tx.query(
      `INSERT INTO webhook_endpoints (id, tenant_id, url, secret_hash, event_types, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb, true, now())`,
      [id, tenantId, url, secretEnc, JSON.stringify(eventTypes)]);
    return id;
  }

  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<{ id: string } | null> {
    const r = await tx.query(`SELECT id FROM webhook_endpoints WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ?? null;
  }

  async update(tx: TxContext, tenantId: string, id: string, patch: { eventTypes?: string[]; isActive?: boolean }): Promise<void> {
    await tx.query(
      `UPDATE webhook_endpoints
          SET event_types = COALESCE($3::jsonb, event_types),
              is_active   = COALESCE($4, is_active),
              updated_at  = now()
        WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId, patch.eventTypes ? JSON.stringify(patch.eventTypes) : null, patch.isActive ?? null]);
  }

  async rotateSecret(tx: TxContext, tenantId: string, id: string, secretEnc: string): Promise<void> {
    await tx.query(`UPDATE webhook_endpoints SET secret_hash=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [id, tenantId, secretEnc]);
  }

  async remove(tx: TxContext, tenantId: string, id: string): Promise<number> {
    const r = await tx.query(`DELETE FROM webhook_endpoints WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rowCount ?? 0;
  }

  // ---- fanout (runs in the producing event's tx) ----
  /** Active endpoints in this tenant subscribed to `eventType` (event_types is a jsonb array). */
  async activeEndpointsForEvent(tx: TxContext, tenantId: string, eventType: string): Promise<string[]> {
    const r = await tx.query(
      `SELECT id FROM webhook_endpoints
        WHERE tenant_id=$1 AND is_active = true AND event_types ? $2 LIMIT 500`, [tenantId, eventType]);
    return r.rows.map((x: any) => x.id);
  }
  async enqueue(tx: TxContext, tenantId: string, endpointId: string, eventType: string, payload: unknown): Promise<void> {
    await tx.query(
      `INSERT INTO webhook_deliveries (endpoint_id, tenant_id, event_type, payload, attempt, succeeded, next_retry_at, created_at)
       VALUES ($1,$2,$3,$4::jsonb, 1, false, now(), now())`,
      [endpointId, tenantId, eventType, JSON.stringify(payload ?? {})]);
  }

  // ---- delivery worker (kv_relay system pool; cross-tenant claim) ----
  async claimDue(tx: TxContext, now: Date, limit: number): Promise<DueDelivery[]> {
    const r = await tx.query(
      `SELECT d.id, d.created_at, d.tenant_id, d.endpoint_id, d.event_type, d.payload, d.attempt,
              e.url, e.secret_hash
         FROM webhook_deliveries d
         JOIN webhook_endpoints e ON e.id = d.endpoint_id
        WHERE d.succeeded = false AND d.next_retry_at <= $1 AND e.is_active = true
        ORDER BY d.next_retry_at
        FOR UPDATE OF d SKIP LOCKED
        LIMIT $2`, [now, limit]);
    return r.rows.map((x: any) => ({
      id: x.id, createdAt: new Date(x.created_at).toISOString(), tenantId: x.tenant_id, endpointId: x.endpoint_id,
      eventType: x.event_type, payload: x.payload, attempt: x.attempt, url: x.url, secretEnc: x.secret_hash,
    }));
  }
  async markResult(tx: TxContext, id: string, createdAt: string, r: { succeeded: boolean; statusCode: number | null; attempt: number; nextRetryAt: Date | null }): Promise<void> {
    await tx.query(
      `UPDATE webhook_deliveries SET succeeded=$3, status_code=$4, attempt=$5, next_retry_at=$6
        WHERE id=$1 AND created_at=$2`, [id, createdAt, r.succeeded, r.statusCode, r.attempt, r.nextRetryAt]);
  }
}
