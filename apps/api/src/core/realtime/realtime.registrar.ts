// core/realtime/realtime.registrar.ts
// Registers one RealtimeFanoutHandler per mapped eventType into the shared OutboxHandlerRegistry at boot,
// so the relay fans those domain events out to Redis Pub/Sub (→ realtime-gateway → live sockets). Lives in
// CoreModule's injector (alongside the registry, the publisher, and FlagsService) to avoid cross-module DI
// ordering questions. The fan-out itself is gated by the `realtime_fanout` flag (default OFF) at handle-time,
// so registering the handlers here is always safe — they are inert until the flag is turned on.
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { OUTBOX_HANDLER_REGISTRY } from '../outbox/event-envelope';
import { OutboxHandlerRegistry } from '../outbox/outbox.dispatcher';
import { FlagsService } from '../feature-flags/flags.service';
import { REALTIME_PUBLISHER, RealtimePublisher } from './realtime-publisher';
import { RealtimeFanoutHandler } from './realtime-fanout.handler';
import { REALTIME_FANOUT_EVENT_TYPES } from './realtime-channels';

@Injectable()
export class RealtimeFanoutRegistrar implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    @Inject(REALTIME_PUBLISHER) private readonly publisher: RealtimePublisher,
    private readonly flags: FlagsService,
  ) {}

  onModuleInit(): void {
    for (const eventType of REALTIME_FANOUT_EVENT_TYPES) {
      this.registry.register(new RealtimeFanoutHandler(eventType, this.publisher, this.flags));
    }
  }
}
