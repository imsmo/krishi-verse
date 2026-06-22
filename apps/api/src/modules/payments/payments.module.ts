// modules/payments/payments.module.ts
// Money-IN vertical: payment intents + signed gateway webhooks → wallet ledger (via WALLET_SERVICE)
// + refunds. The gateway registry wires the deterministic sandbox (always) and Razorpay (when
// RAZORPAY_* env is configured); the default provider is config-driven so swapping PSP is config.
// Money movement itself lives in core/wallet (Law 2); this module never INSERTs ledger rows.
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ResilienceService } from '../../core/resilience/resilience.service';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
import { PaymentsController } from './controllers/v1/payments.controller';
import { PaymentWebhooksController } from './controllers/v1/payment-webhooks.controller';
import { PayoutsController } from './controllers/v1/payouts.controller';
import { PaymentService } from './services/payment.service';
import { PayoutService } from './services/payout.service';
import { PaymentRepository } from './repositories/payment.repository';
import { PayoutRepository } from './repositories/payout.repository';
import { CommissionRuleRepository } from './repositories/commission-rule.repository';
import { TaxRuleRepository } from './repositories/tax-rule.repository';
import { SettlementPricingService } from './services/settlement-pricing.service';
import { SettlementLineRepository } from './repositories/settlement-line.repository';
import { SettlementStatementRepository } from './repositories/settlement-statement.repository';
import { TradeInvoiceRepository } from './repositories/trade-invoice.repository';
import { SettlementStatementService } from './services/settlement-statement.service';
import { TradeInvoiceService } from './services/trade-invoice.service';
import { ChargeDefinitionRepository } from './repositories/charge-definition.repository';
import { ChargePricingService } from './services/charge-pricing.service';
import { DocumentPdfService } from './services/document-pdf.service';
import { MediaModule } from '../../core/media/media.module';
import { TradeInvoiceHandler } from './events/handlers/trade-invoice.handler';
import { SettlementStatementsController } from './controllers/v1/settlement-statements.controller';
import { InvoicesController } from './controllers/v1/invoices.controller';
import { CommissionRulesController } from './controllers/v1/commission-rules.controller';
import { CommissionRuleService } from './services/commission-rule.service';
import { GatewayRegistry } from './gateway/gateway.registry';
import { SandboxGateway } from './gateway/sandbox.gateway';
import { RazorpayGateway } from './gateway/razorpay.gateway';
import { PAYOUT_GATEWAY } from './gateway/payout-gateway.port';
import { RazorpayXGateway } from './gateway/razorpayx.gateway';
import { SandboxPayoutGateway } from './gateway/sandbox-payout.gateway';
import { OrderCompletedHandler } from './events/handlers/order-completed.handler';
import { DisputeResolvedHandler } from './events/handlers/dispute-resolved.handler';
import { BookingClockedOutHandler } from './events/handlers/booking-clocked-out.handler';
import { RazorpayPayoutWebhookHandler } from './events/handlers/razorpay-webhook.handler';
import { PaymentsPublisher } from './events/payments.publisher';
import { PayoutBatchRepository } from './repositories/payout-batch.repository';
import { PayoutBatchService } from './services/payout-batch.service';
import { WalletBalanceReadModel } from './read-models/wallet-balance.read-model';

@Module({
  imports: [MediaModule],   // MediaService for rendered statement/invoice PDFs
  controllers: [PaymentsController, PaymentWebhooksController, PayoutsController, SettlementStatementsController, InvoicesController, CommissionRulesController],
  providers: [
    PaymentService,
    PayoutService,
    CommissionRuleService,
    DocumentPdfService,
    PaymentRepository,
    PayoutRepository,
    CommissionRuleRepository,
    TaxRuleRepository,
    SettlementPricingService,
    SettlementLineRepository,
    SettlementStatementRepository,
    TradeInvoiceRepository,
    SettlementStatementService,
    TradeInvoiceService,
    ChargeDefinitionRepository,
    ChargePricingService,
    OrderCompletedHandler,
    TradeInvoiceHandler,
    DisputeResolvedHandler,
    BookingClockedOutHandler,
    RazorpayPayoutWebhookHandler,
    PaymentsPublisher,
    PayoutBatchRepository,
    PayoutBatchService,
    WalletBalanceReadModel,
    {
      provide: GatewayRegistry,
      useFactory: (resilience: ResilienceService) => {
        const reg = new GatewayRegistry();
        const sandboxOnly = !process.env.RAZORPAY_KEY_ID;
        reg.register(new SandboxGateway(process.env.SANDBOX_WEBHOOK_SECRET || 'sandbox-secret'), sandboxOnly);
        if (process.env.RAZORPAY_KEY_ID) {
          reg.register(new RazorpayGateway({
            keyId: process.env.RAZORPAY_KEY_ID!, keySecret: process.env.RAZORPAY_KEY_SECRET || '',
            webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '', baseUrl: process.env.RAZORPAY_BASE_URL,
          }, resilience), (process.env.PAYMENTS_DEFAULT_PROVIDER ?? 'razorpay') === 'razorpay');
        }
        // tune the razorpay dependency policy (money calls: no auto-retry without idempotency)
        resilience.configure('razorpay', { timeoutMs: 8000, retries: 1, circuit: { failureThreshold: 5, resetMs: 15_000, halfOpenMax: 2 }, bulkhead: { maxConcurrent: 16, maxQueue: 64 } });
        return reg;
      },
      inject: [ResilienceService],
    },
    {
      // money-OUT gateway: RazorpayX when configured, else the deterministic sandbox.
      provide: PAYOUT_GATEWAY,
      useFactory: (resilience: ResilienceService) => {
        if (process.env.RAZORPAYX_KEY_ID) {
          resilience.configure('razorpayx', { timeoutMs: 8000, retries: 0, circuit: { failureThreshold: 5, resetMs: 15_000, halfOpenMax: 2 }, bulkhead: { maxConcurrent: 16, maxQueue: 64 } });
          return new RazorpayXGateway({ keyId: process.env.RAZORPAYX_KEY_ID!, keySecret: process.env.RAZORPAYX_KEY_SECRET || '', accountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER || '', baseUrl: process.env.RAZORPAYX_BASE_URL }, resilience);
        }
        return new SandboxPayoutGateway('success');
      },
      inject: [ResilienceService],
    },
  ],
  exports: [PaymentService, PayoutService, PayoutBatchService, ChargePricingService, WalletBalanceReadModel],
})
export class PaymentsModule implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    private readonly orderCompleted: OrderCompletedHandler,
    private readonly tradeInvoice: TradeInvoiceHandler,
    private readonly disputeResolved: DisputeResolvedHandler,
    private readonly bookingClockedOut: BookingClockedOutHandler,
  ) {}
  onModuleInit(): void {
    this.registry.register(this.orderCompleted);   // settlement split + settlement line
    this.registry.register(this.tradeInvoice);     // buyer GST invoice (fan-out to the same event)
    this.registry.register(this.disputeResolved);  // dispute refund: escrow → buyer wallet (flag dispute_refunds)
    this.registry.register(this.bookingClockedOut); // labour.wages_paid → promote wage payouts (flag wage_priority_payout)
  }
}
