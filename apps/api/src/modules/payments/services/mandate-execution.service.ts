// modules/payments/services/mandate-execution.service.ts
// UPI AutoPay EXECUTION use-cases — the ONLY money-moving path in the autopay subsystem (P0-4).
//   • confirm(id, providerRef?) — PSP confirmed the standing instruction → mandate pending→active (Law 5).
//   • execute(id, {amountMinor, idempotencyKey}) — present a capped debit and land the funds in the user's
//     wallet as a mandate-funded top-up.
// Both are gated by the `autopay_execution` feature flag (fail-closed — unknown/OFF ⇒ refuse), because both
// require a live UPI-AutoPay PSP + webhook that are not yet wired. The money move happens ONLY through
// WalletPort.post (Law 2): a balanced pair platform(gateway) −amount / userMain +amount, txnType
// 'autopay_collection', idempotent on the caller's key. The execution row is the audit + idempotency record;
// it never holds money. Every write is one ACID tx (UoW) → outbox in-tx (Law 4) → audit.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { FlagsService } from '../../../core/feature-flags/flags.service';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { DomainEvent } from '../domain/payments.events';
import { MandateRepository } from '../repositories/mandate.repository';
import { MandateExecutionRepository } from '../repositories/mandate-execution.repository';
import { MANDATE_GATEWAY, MandateGateway } from '../gateway/mandate-gateway.port';
import { MandateNotFoundError, MandateExecutionDisabledError } from '../domain/payments.errors';

export interface MandateActor { userId: string; canModerate: boolean; }

@Injectable()
export class MandateExecutionService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    @Inject(MANDATE_GATEWAY) private readonly gateway: MandateGateway,
    private readonly flags: FlagsService,
    private readonly audit: AuditWriter,
    private readonly mandates: MandateRepository,
    private readonly executions: MandateExecutionRepository,
  ) {}

  /** PSP confirmed the standing instruction → activate the mandate. Idempotent (a repeat confirm is a no-op). */
  async confirm(tenantId: string, actor: MandateActor, id: string, providerRef: string | null, ip: string | null) {
    await this.assertEnabled(tenantId, actor.userId);
    return timed(this.metrics, 'payments.confirm_mandate', { tenant: tenantId }, async () =>
      this.uow.run(tenantId, async (tx) => {
        const mandate = await this.mandates.getForUpdate(tx, tenantId, id);
        if (!mandate || (mandate.userId !== actor.userId && !actor.canModerate)) throw new MandateNotFoundError(id);
        // Ask the PSP for the mandate token unless the caller carries a verified one (webhook path).
        const ref = providerRef ?? (await this.gateway.confirmMandate({
          mandateId: mandate.id, vpaMasked: mandate.toProps().vpaMasked,
          maxAmountMinor: mandate.maxAmountMinor, currencyCode: mandate.currencyCode, frequency: mandate.toProps().frequency,
        })).providerMandateRef;
        const changed = mandate.activate(ref);
        if (changed) {
          await this.mandates.update(tx, mandate);
          await this.flush(tx, tenantId, id, mandate.pullEvents());
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'mandate.activated', entityType: 'upi_mandate', entityId: id, newValue: { provider: mandate.toProps().providerCode }, ip });
        }
        return this.serializeMandate(mandate.toProps());
      }, { userId: actor.userId }));
  }

  /** Present a capped debit: lock the mandate, guard (active + ≤ cap), collect via PSP, land funds in the wallet. */
  async execute(tenantId: string, actor: MandateActor, mandateId: string, input: { amountMinor: string; idempotencyKey: string }, ip: string | null) {
    await this.assertEnabled(tenantId, actor.userId);
    const amountMinor = BigInt(input.amountMinor);
    return timed(this.metrics, 'payments.execute_mandate', { tenant: tenantId }, async () =>
      this.uow.run(tenantId, async (tx) => {
        // Idempotency (Law 3): a replay of the same key returns the same execution — never double-collects.
        const prior = await this.executions.findByIdemForUpdate(tx, tenantId, input.idempotencyKey);
        if (prior) return this.serializeExecution(prior);

        const mandate = await this.mandates.getForUpdate(tx, tenantId, mandateId);
        if (!mandate || (mandate.userId !== actor.userId && !actor.canModerate)) throw new MandateNotFoundError(mandateId);

        const executionId = uuidv7();
        // Domain guard: throws if not active or over cap (records the Executed event on success). No state change.
        mandate.assertCollectable(amountMinor, { executionId, idempotencyKey: input.idempotencyKey });

        await this.executions.insertPending(tx, {
          id: executionId, tenantId, mandateId, userId: mandate.userId,
          amountMinor, currencyCode: mandate.currencyCode, idempotencyKey: input.idempotencyKey,
        });

        // Present the debit to the PSP. On failure, mark the row failed and surface a non-sensitive error.
        let providerPaymentRef: string;
        try {
          ({ providerPaymentRef } = await this.gateway.collect({
            mandateId, providerMandateRef: mandate.providerMandateRef ?? '',
            amountMinor, currencyCode: mandate.currencyCode, idempotencyKey: input.idempotencyKey,
          }));
        } catch (err) {
          await this.executions.markFailed(tx, tenantId, executionId, 'psp_collect_failed');
          throw err;
        }

        // THE money move (Law 2): gateway → user wallet, balanced double-entry, idempotent on the same key.
        const posted = await this.wallet.post(tx, {
          tenantId, txnType: 'autopay_collection', idempotencyKey: `autopay:${input.idempotencyKey}`,
          legs: [
            { account: platform(PlatformAccount.Gateway, mandate.currencyCode), amountMinor: -amountMinor },
            { account: userMain(mandate.userId, mandate.currencyCode), amountMinor },
          ],
          referenceType: 'upi_mandate_execution', referenceId: executionId,
          initiatedBy: actor.userId, description: 'UPI AutoPay collection',
        });

        await this.executions.markCollected(tx, tenantId, executionId, providerPaymentRef, posted.txnId);
        await this.flush(tx, tenantId, mandateId, mandate.pullEvents());
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'mandate.executed', entityType: 'upi_mandate_execution', entityId: executionId, newValue: { mandateId, amountMinor: input.amountMinor, txnId: posted.txnId }, ip });

        const row = await this.executions.findByIdemForUpdate(tx, tenantId, input.idempotencyKey);
        return this.serializeExecution(row!);
      }, { userId: actor.userId }));
  }

  /** Recent executions for a mandate the caller owns (audit list). */
  async listExecutions(tenantId: string, actor: MandateActor, mandateId: string, limit: number) {
    const mandate = await this.mandates.getVisible(tenantId, mandateId, actor.userId, actor.canModerate);
    if (!mandate) throw new MandateNotFoundError(mandateId);
    return (await this.executions.listForMandate(tenantId, mandateId, limit)).map((e) => this.serializeExecution(e));
  }

  private async assertEnabled(tenantId: string, userId: string): Promise<void> {
    if (!(await this.flags.isEnabled('autopay_execution', { tenantId, userId }))) throw new MandateExecutionDisabledError();
  }

  private serializeMandate(m: any) {
    return { id: m.id, status: m.status, purpose: m.purpose, vpaMasked: m.vpaMasked, provider: m.providerCode,
      maxAmountMinor: m.maxAmountMinor.toString(), currencyCode: m.currencyCode, frequency: m.frequency,
      validUntil: m.validUntil, createdAt: m.createdAt };
  }
  private serializeExecution(e: { id: string; mandateId: string; amountMinor: bigint; currencyCode: string; status: string; providerPaymentRef: string | null; ledgerTxnId: string | null; failureReason: string | null; createdAt: Date }) {
    return { id: e.id, mandateId: e.mandateId, amountMinor: e.amountMinor.toString(), currencyCode: e.currencyCode,
      status: e.status, providerPaymentRef: e.providerPaymentRef, ledgerTxnId: e.ledgerTxnId,
      failureReason: e.failureReason, createdAt: e.createdAt };
  }

  private async flush(tx: TxContext, tenantId: string, mandateId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'upi_mandate', aggregateId: mandateId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
