// modules/disputes/disputes.module.ts
// Order disputes (M-disputes): a party to a DELIVERED order raises a dispute against the counterparty
// (eligibility recorded from orders.order_delivered); parties exchange threaded evidence; a moderator
// reviews/escalates/resolves. Opening pauses the order (orders sets it 'disputed'); resolving emits
// disputes.dispute_resolved so orders applies the refund/release. NO money moves here (the wallet
// reversal is a flagged downstream step). Gated by the `disputes` feature flag (default OFF).
//
// SCOPE: this build ships the dispute-resolution spine + threaded messages. The `returns` flow
// (return shipment lifecycle) scaffolded here is DEFERRED to a later wave (stubs, not wired).
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
import { DisputesController } from './controllers/v1/disputes.controller';
import { DisputeService } from './services/dispute.service';
import { DisputeRepository } from './repositories/dispute.repository';
import { DisputeMessageRepository } from './repositories/dispute-message.repository';
import { OrderDeliveredHandler } from './events/handlers/order-delivered.handler';
import { DisputeRefundedHandler } from './events/handlers/dispute-refunded.handler';

@Module({
  controllers: [DisputesController],
  providers: [DisputeService, DisputeRepository, DisputeMessageRepository, OrderDeliveredHandler, DisputeRefundedHandler],
  exports: [DisputeService],
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
