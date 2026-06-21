// core/realtime/realtime-fanout.handler.ts
// The bridge from the transactional outbox to live fan-out. One handler instance is registered per
// mapped eventType (REALTIME_FANOUT_EVENT_TYPES). When the relay processes a matching event it calls
// handle(): we project the event to NON-PII RealtimeMessages (projectEvent) and publish each, BEST-EFFORT.
//
// Critical correctness rules:
//  • It is gated by the `realtime_fanout` flag (default OFF) — a runtime kill-switch (Law 10).
//  • Publishing is a non-transactional side effect; it MUST NOT throw, or the relay would roll the event
//    back and mark it failed. Realtime is ephemeral + at-least-once-ish; the publisher swallows transport
//    errors and we wrap the whole thing defensively too (Law 12 — degrade, never die).
//  • No PII leaves here: projectEvent already drops identities/sealed amounts; we add nothing.
import { Logger } from '@nestjs/common';
import type { OutboxEvent, OutboxHandler } from '../outbox/event-envelope';
import type { TxContext } from '../database/unit-of-work';
import type { FlagsService } from '../feature-flags/flags.service';
import type { RealtimePublisher } from './realtime-publisher';
import { projectEvent } from './realtime-channels';

export class RealtimeFanoutHandler implements OutboxHandler {
  private readonly log = new Logger(RealtimeFanoutHandler.name);
  constructor(
    public readonly eventType: string,
    private readonly publisher: RealtimePublisher,
    private readonly flags: FlagsService,
  ) {}

  async handle(event: OutboxEvent, _tx: TxContext): Promise<void> {
    try {
      if (!(await this.flags.isEnabled('realtime_fanout', { tenantId: event.tenantId ?? undefined }))) return;  // kill-switch
      const messages = projectEvent({
        tenantId: event.tenantId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        payload: event.payload ?? {},
      });
      for (const m of messages) await this.publisher.publish(m);   // publisher is itself never-throw
    } catch (err) {
      // A fan-out failure must never fail the relay tx. Log and move on.
      this.log.debug?.(`realtime fanout skipped for ${event.eventType}: ${(err as Error)?.message ?? 'err'}`);
    }
  }
}
