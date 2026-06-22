// modules/disputes/disputes.module.ts
// Order disputes (M-disputes): a party to a DELIVERED order raises a dispute against the counterparty
// (eligibility recorded from orders.order_delivered); parties exchange threaded evidence; a moderator
// reviews/escalates/resolves. Opening pauses the order (orders sets it 'disputed'); resolving emits
// disputes.dispute_resolved so orders applies the refund/release. NO money moves here (the wallet
// reversal is a flagged downstream step). Gated by the `disputes` feature flag (default OFF).
//
// SCOPE: ships the dispute-resolution spine + threaded messages (DisputeMessageService) + the
// returns/RMA sub-domain (ReturnService/ReturnsController) + the SLA worker jobs (API-W3-09).
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
import { DisputesController } from './controllers/v1/disputes.controller';
import { ReturnsController } from './controllers/v1/returns.controller';
import { DisputeService } from './services/dispute.service';
import { DisputeMessageService } from './services/dispute-message.service';
import { ReturnService } from './services/return.service';
import { DisputeRepository } from './repositories/dispute.repository';
import { DisputeMessageRepository } from './repositories/dispute-message.repository';
import { ReturnRepository } from './repositories/return.repository';
import { OrderDeliveredHandler } from './events/handlers/order-delivered.handler';
import { DisputeRefundedHandler } from './events/handlers/dispute-refunded.handler';

@Module({
  controllers: [DisputesController, ReturnsController],
  providers: [
    DisputeService, DisputeMessageService, ReturnService,
    DisputeRepository, DisputeMessageRepository, ReturnRepository,
    OrderDeliveredHandler, DisputeRefundedHandler,
  ],
  exports: [DisputeService, ReturnService],
})
export class DisputesModule implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    private readonly orderDelivered: OrderDeliveredHandler,
    private readonly disputeRefunded: DisputeRefundedHandler,
  ) {}
  // record dispute eligibility when an order is delivered (orders.order_delivered)
  onModuleInit(): void { this.registry.register(this.orderDelivered); this.registry.register(this.disputeRefunded); }
}
