// modules/logistics/logistics.module.ts
// Order fulfilment (M07): a confirmed order auto-creates a SHIPMENT (orders.order_confirmed →
// OrderConfirmedHandler), which ops/riders drive pending→…→out_for_delivery→delivered. Proof-of-delivery
// is OTP-gated; on delivery it emits logistics.shipment_delivered → orders marks the order delivered
// (→ quality window → settlement). NO money moves here. Gated by the `logistics` feature flag (OFF).
//
// SCOPE: this build ships the shipment vertical (the order-fulfilment spine) PLUS the fleet registry
// (API-W3-03): logistics partners (3PL / tenant fleet / rider), their vehicles, and a seller's weekly
// pickup slots. The remaining master-data sub-features scaffolded under this module — delivery zones,
// routes (Village Run), cold-chain logs — are DEFERRED to a later logistics-ops wave (their files are
// left as documented stubs and are NOT wired here).
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
import { ShipmentsController } from './controllers/v1/shipments.controller';
import { PartnersController, VehiclesController, PickupSlotsController } from './controllers/v1/partners.controller';
import { ShipmentService } from './services/shipment.service';
import { ShipmentRepository } from './repositories/shipment.repository';
import { LogisticsPartnerService } from './services/logistics-partner.service';
import { VehicleService } from './services/vehicle.service';
import { PickupSlotService } from './services/pickup-slot.service';
import { LogisticsPartnerRepository } from './repositories/logistics-partner.repository';
import { VehicleRepository } from './repositories/vehicle.repository';
import { PickupSlotRepository } from './repositories/pickup-slot.repository';
import { OrderConfirmedHandler } from './events/handlers/order-confirmed.handler';

@Module({
  controllers: [ShipmentsController, PartnersController, VehiclesController, PickupSlotsController],
  providers: [
    ShipmentService, ShipmentRepository, OrderConfirmedHandler,
    LogisticsPartnerService, VehicleService, PickupSlotService,
    LogisticsPartnerRepository, VehicleRepository, PickupSlotRepository,
  ],
  exports: [ShipmentService, LogisticsPartnerService, VehicleService, PickupSlotService],
})
export class LogisticsModule implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    private readonly orderConfirmed: OrderConfirmedHandler,
  ) {}
  // auto-create a shipment when an order is confirmed (orders.order_confirmed → pending shipment)
  onModuleInit(): void { this.registry.register(this.orderConfirmed); }
}
