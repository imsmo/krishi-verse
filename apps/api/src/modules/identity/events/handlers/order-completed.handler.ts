// modules/identity/events/handlers/order-completed.handler.ts
// Cross-module reaction: a completed order is a positive trust signal → record a risk
// event (recomputed into the score by the nightly job). Idempotency is at the consumer.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../core/database/unit-of-work';
import { RiskScoreRepository } from '../../repositories/risk-score.repository';

interface OrderCompletedV1 { v: 1; tenantId: string; buyerUserId: string; orderId: string; }

@Injectable()
export class OrderCompletedHandler {
  private readonly log = new Logger(OrderCompletedHandler.name);
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, private readonly risk: RiskScoreRepository) {}
  async handle(evt: OrderCompletedV1): Promise<void> {
    await this.uow.run(evt.tenantId, (tx) => this.risk.recordEvent(tx, { tenantId: evt.tenantId, userId: evt.buyerUserId, eventCode: 'order_completed', weight: 2, referenceType: 'order', referenceId: evt.orderId }));
    this.log.debug(`risk +2 for ${evt.buyerUserId} (order ${evt.orderId})`);
  }
}
