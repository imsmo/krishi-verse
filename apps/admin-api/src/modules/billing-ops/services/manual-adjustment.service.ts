// apps/admin-api/src/modules/billing-ops/services/manual-adjustment.service.ts · apply a MANUAL billing
// adjustment (goodwill credit / clawback debit) to a tenant. THE MONEY MOVES ONLY VIA THE WALLET-SERVICE
// (Law 2/9): this service builds balanced double-entry legs and calls the WalletAdminPort — it NEVER writes the
// ledger. Flow (idempotent + degrade-never-die):
//   1. validate amount (bigint minor units, capped) + tenant exists (404);
//   2. idempotent replay — if we already recorded this (tenant, key), return it (money already moved, no re-post);
//   3. call the wallet-service with a stable idempotency key (replay there is a no-op too);
//   4. in ONE admin tx, record the billing_adjustments row + write the audit row atomically.
// A wallet failure records an audit 'failed' entry and surfaces a typed 502 — no local row, so a retry is clean.
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { WALLET_ADMIN, WalletAdminPort } from '../../../core/wallet/wallet-admin.port';
import { BillingRepository, AdjustmentListQuery } from '../repositories/billing.repository';
import { assertAdjustmentAmount, buildAdjustmentLegs } from '../domain/adjustment';
import { BillingTenantNotFoundError, WalletAdjustmentFailedError } from '../domain/billing-ops.errors';
import { ApplyAdjustmentDto } from '../dto/billing-ops.dto';

@Injectable()
export class ManualAdjustmentService {
  constructor(
    private readonly pool: AdminPool,
    private readonly audit: AdminAuditWriter,
    private readonly repo: BillingRepository,
    @Inject(WALLET_ADMIN) private readonly wallet: WalletAdminPort,
  ) {}

  async apply(actor: AdminRequestContext, dto: ApplyAdjustmentDto) {
    const amount = assertAdjustmentAmount(BigInt(dto.amountMinor));        // throws InvalidAdjustmentError (422)
    if (!(await this.repo.tenantExists(dto.tenantId))) throw new BillingTenantNotFoundError(dto.tenantId);

    // Idempotency scoped per (tenant, client key): one tenant's key can never collide with another's (§4).
    const walletKey = `billing_adjustment:${dto.tenantId}:${dto.idempotencyKey}`;
    const replay = await this.repo.getAdjustmentByKey(walletKey);
    if (replay) return replay;                                            // money already moved — no double action

    const id = randomUUID();
    const legs = buildAdjustmentLegs(dto.tenantId, dto.direction, amount);

    let res: { txnId: string; alreadyApplied: boolean };
    try {
      res = await this.wallet.post({
        tenantId: dto.tenantId, txnType: 'billing_adjustment', idempotencyKey: walletKey, legs, currencyCode: dto.currency,
        referenceType: 'billing_adjustment', referenceId: id, initiatedBy: actor.userId, description: dto.reason,
      });
    } catch (e: any) {
      await this.audit.log({ actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'billing.adjustment_failed', entityType: 'billing_adjustment', entityId: id,
        newValue: { tenantId: dto.tenantId, direction: dto.direction, amountMinor: amount.toString() }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      throw new WalletAdjustmentFailedError(e?.message ?? 'wallet-service error');
    }

    return this.pool.withTx(async (client) => {
      const row = await this.repo.insertAdjustment(client, {
        id, tenantId: dto.tenantId, subscriptionId: dto.subscriptionId ?? null, invoiceId: dto.invoiceId ?? null,
        direction: dto.direction, amountMinor: amount, currency: dto.currency, reason: dto.reason, idempotencyKey: walletKey, walletTxnId: res.txnId, actorUserId: actor.userId,
      });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'billing.adjustment_applied', entityType: 'billing_adjustment', entityId: row.id,
        newValue: { tenantId: dto.tenantId, direction: dto.direction, amountMinor: amount.toString(), walletTxnId: res.txnId, alreadyApplied: res.alreadyApplied }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return row;
    });
  }

  async list(q: AdjustmentListQuery) {
    const items = await this.repo.listAdjustments(q);
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
