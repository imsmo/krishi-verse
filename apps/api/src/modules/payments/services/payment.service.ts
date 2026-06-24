// modules/payments/services/payment.service.ts
// Money-IN use-cases. Every write: one ACID tx (UoW) → ledger move via the WALLET port (the only
// money writer, Law 2) → status via the state machine (Law 5) → outbox event in the SAME tx
// (Law 4) → audit. Idempotent (Law 3): create on the caller's key, webhook on the gateway event
// id. The webhook is unauthenticated — verified by signature, tenant taken from the signed notes.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { platform, userMain, PlatformAccount } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Payment } from '../domain/payment.entity';
import { DomainEvent } from '../domain/payments.events';
import { PaymentRepository } from '../repositories/payment.repository';
import { GatewayRegistry } from '../gateway/gateway.registry';
import { CreatePaymentIntentDto, RefundPaymentDto } from '../dto/create-payment.dto';
import { PaymentNotFoundError, WebhookSignatureError, PaymentAmountMismatchError, InsufficientWalletBalanceError } from '../domain/payments.errors';
import { BadRequestError, InfraError } from '../../../shared/errors/app-error';

export interface PaymentActor { userId: string; canModerate: boolean; }

@Injectable()
export class PaymentService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly audit: AuditWriter,
    private readonly repo: PaymentRepository,
    private readonly gateways: GatewayRegistry,
  ) {}

  /** Create a payment intent: persist 'initiated' + create the gateway order, in one tx. */
  async createIntent(tenantId: string, userId: string, idemKey: string, dto: CreatePaymentIntentDto) {
    return this.idem.remember(idemKey, userId, 'payments.create_intent', () =>
      timed(this.metrics, 'payments.create_intent', { tenant: tenantId }, async () => {
        const purposeId = await this.repo.resolvePurposeId(tenantId, dto.purpose);
        if (!purposeId) throw new BadRequestError(`Unknown payment purpose '${dto.purpose}'`);
        const gateway = this.gateways.default();
        const id = uuidv7();
        const payment = Payment.initiate({
          id, tenantId, userId, purposeId, referenceType: dto.referenceType ?? null, referenceId: dto.referenceId ?? null,
          amountMinor: BigInt(dto.amountMinor), currencyCode: dto.currencyCode, providerCode: gateway.providerCode, idempotencyKey: idemKey,
        });
        // Create the gateway order OUTSIDE the DB tx (external call), then persist with its id.
        const order = await gateway.createOrder({
          amountMinor: payment.amountMinor, currencyCode: dto.currencyCode, receipt: id,
          notes: { tenant_id: tenantId, payment_id: id },   // echoed back in the signed webhook
        });
        payment.attachGatewayOrder(order.gatewayOrderId);

        return this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, payment);
          await this.flush(tx, tenantId, id, payment.pullEvents());
          return { paymentId: id, gatewayOrderId: order.gatewayOrderId, provider: gateway.providerCode, amountMinor: dto.amountMinor, status: payment.status };
        }, { userId });
      }));
  }

  /** Gateway webhook (unauthenticated). Verify signature → idempotent on the event id → move money. */
  async handleWebhook(providerCode: string, rawBody: string, signature: string) {
    const gateway = this.gateways.get(providerCode);
    if (!gateway.verifySignature(rawBody, signature)) throw new WebhookSignatureError();   // fail closed
    const event = gateway.parseEvent(rawBody);
    if (event.kind === 'ignored') return { ok: true, ignored: true };
    if (!event.tenantId || !event.gatewayOrderId) throw new BadRequestError('webhook missing tenant/order context');

    return this.idem.remember(event.eventId, 'system', `payments.webhook.${providerCode}`, () =>
      timed(this.metrics, 'payments.webhook', { provider: providerCode, kind: event.kind }, async () =>
        this.uow.run(event.tenantId!, async (tx) => {
          const payment = await this.repo.getByGatewayOrderForUpdate(tx, event.tenantId!, event.gatewayOrderId!);
          if (!payment) return { ok: true, unknown: true };          // not ours / already gone

          if (event.kind === 'payment_captured') {
            if (event.amountMinor !== undefined && event.amountMinor !== payment.amountMinor) {
              throw new PaymentAmountMismatchError(payment.amountMinor, event.amountMinor); // tamper guard
            }
            // money arrives: external funds (platform gateway account) → platform escrow. Zero-sum.
            const txn = await this.wallet.post(tx, {
              tenantId: payment.tenantId, txnType: 'order_payment', idempotencyKey: `pay:${payment.id}`,
              referenceType: 'payment', referenceId: payment.id, initiatedBy: payment.userId,
              legs: [
                { account: platform(PlatformAccount.Escrow), amountMinor: payment.amountMinor },
                { account: platform(PlatformAccount.Gateway), amountMinor: -payment.amountMinor },
              ],
            });
            const changed = payment.markCaptured(event.gatewayPaymentId ?? '', event.method ?? null, txn.txnId);
            if (changed) {
              await this.repo.update(tx, payment);
              await this.flush(tx, payment.tenantId, payment.id, payment.pullEvents());
              await this.audit.write(tx, { tenantId: payment.tenantId, actorUserId: payment.userId, action: 'payment.captured', entityType: 'payment', entityId: payment.id, newValue: { status: 'success' }, ip: null });
            }
          } else if (event.kind === 'payment_failed') {
            if (payment.markFailed(event.failureCode ?? null, event.failureReason ?? null)) {
              await this.repo.update(tx, payment);
              await this.flush(tx, payment.tenantId, payment.id, payment.pullEvents());
            }
          }
          return { ok: true };
        }, { userId: 'system' })));
  }

  /** Refund (full or partial): reverse the escrow leg + record on the payment. Admin/moderator.
   *  Issuing the PSP card/UPI refund is confirmed via the 'refund.processed' webhook (next wave);
   *  this performs the LEDGER reversal + status transition that the platform controls. */
  async refund(tenantId: string, actor: PaymentActor, paymentId: string, dto: RefundPaymentDto, ip: string | null) {
    if (!actor.canModerate) throw new InfraError('PAYMENT_REFUND_FORBIDDEN', 'refund requires moderator', {});
    return timed(this.metrics, 'payments.refund', { tenant: tenantId }, async () =>
      this.uow.run(tenantId, async (tx) => {
        const payment = await this.repo.getForUpdate(tx, tenantId, paymentId);
        if (!payment) throw new PaymentNotFoundError(paymentId);
        const amount = BigInt(dto.amountMinor);
        const txn = await this.wallet.post(tx, {
          tenantId, txnType: 'escrow_release', idempotencyKey: `refund:${paymentId}:${payment.refundableMinor}`,
          referenceType: 'payment', referenceId: paymentId, initiatedBy: actor.userId,
          legs: [
            { account: platform(PlatformAccount.Gateway), amountMinor: amount },
            { account: platform(PlatformAccount.Escrow), amountMinor: -amount },
          ],
        });
        payment.refund(amount, txn.txnId);
        await this.repo.update(tx, payment);
        await this.flush(tx, tenantId, paymentId, payment.pullEvents());
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'payment.refunded', entityType: 'payment', entityId: paymentId, newValue: { refundedMinor: amount.toString(), reason: dto.reason ?? null }, ip });
        return { paymentId, status: payment.status, refundedMinor: amount.toString() };
      }, { userId: actor.userId }));
  }

  /** Pay an order from the buyer's OWN wallet balance (no gateway). Mirrors a gateway capture's money
   *  move, but the source is the user's wallet rather than the platform gateway account: user main →
   *  platform escrow (zero-sum). Records a 'wallet'-provider Payment in 'success' and emits
   *  payments.payment_succeeded (referenceType 'order') so the existing orders handler confirms the
   *  order — exactly like the gateway path. Runs inside the CALLER'S tx (the orders service owns the
   *  order load/verify + caller-key idempotency). Fails CLOSED when the wallet can't cover it in full.
   *  Money is idempotent on the order (ledger key `walletpay:<orderId>`) so a retry never double-debits. */
  async captureOrderFromWalletInTx(tx: TxContext, input: { tenantId: string; buyerUserId: string; orderId: string; amountMinor: bigint; currencyCode: string }): Promise<{ paymentId: string; ledgerTxnId: string }> {
    const purposeId = await this.repo.resolvePurposeId(input.tenantId, 'direct_order');
    if (!purposeId) throw new BadRequestError("Unknown payment purpose 'direct_order'");
    const buyer = userMain(input.buyerUserId, input.currencyCode);
    const available = await this.wallet.balanceMinor(tx, buyer);              // server-truth spendable balance
    if (available < input.amountMinor) throw new InsufficientWalletBalanceError(input.amountMinor, available);
    const id = uuidv7();
    const payment = Payment.initiate({
      id, tenantId: input.tenantId, userId: input.buyerUserId, purposeId, referenceType: 'order', referenceId: input.orderId,
      amountMinor: input.amountMinor, currencyCode: input.currencyCode, providerCode: 'wallet', idempotencyKey: `walletpay:${input.orderId}`,
    });
    // money MOVES (Law 11): buyer's wallet → platform escrow, in the caller's tx, idempotent on the order.
    const txn = await this.wallet.post(tx, {
      tenantId: input.tenantId, txnType: 'order_payment', idempotencyKey: `walletpay:${input.orderId}`,
      referenceType: 'payment', referenceId: id, initiatedBy: input.buyerUserId,
      legs: [
        { account: platform(PlatformAccount.Escrow, input.currencyCode), amountMinor: input.amountMinor },
        { account: buyer, amountMinor: -input.amountMinor },
      ],
    });
    payment.markCaptured(`wallet:${id}`, 'wallet', txn.txnId);                // → emits payments.payment_succeeded
    await this.repo.insert(tx, payment);
    await this.flush(tx, input.tenantId, id, payment.pullEvents());
    await this.audit.write(tx, { tenantId: input.tenantId, actorUserId: input.buyerUserId, action: 'payment.wallet_captured', entityType: 'payment', entityId: id, newValue: { status: 'success', orderId: input.orderId, amountMinor: input.amountMinor.toString() }, ip: null });
    return { paymentId: id, ledgerTxnId: txn.txnId };
  }

  async getById(tenantId: string, actor: PaymentActor, id: string) {
    const payment = await this.repo.getVisible(tenantId, id, actor.userId, actor.canModerate);
    if (!payment) throw new PaymentNotFoundError(id);
    return this.serialize(payment.toProps());
  }

  async list(tenantId: string, userId: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    const items = (await this.repo.listForUser(tenantId, userId, q)).map((p) => this.serialize(p.toProps()));
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? Buffer.from(`${last.createdAt}|${last.id}`).toString('base64') : null };
  }

  private serialize(p: ReturnType<Payment['toProps']>) {
    return { id: p.id, status: p.status, amountMinor: p.amountMinor.toString(), refundedMinor: p.refundedMinor.toString(),
      currencyCode: p.currencyCode, provider: p.providerCode, method: p.method, referenceType: p.referenceType,
      referenceId: p.referenceId, gatewayOrderId: p.gatewayOrderId, createdAt: p.createdAt };
  }

  private async flush(tx: TxContext, tenantId: string, paymentId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'payment', aggregateId: paymentId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
