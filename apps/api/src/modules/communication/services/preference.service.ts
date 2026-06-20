// modules/communication/services/preference.service.ts · a user's notification preferences + quiet hours.
// A user may DISABLE a channel only for an opt-out-able event — disabling a mandatory event (OTP, dispute,
// payment) THROWS CannotOptOutError (Law 6, fail-closed). Ownership is always the caller's own userId (no IDOR).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { CommEventType } from '../domain/communication.events';
import { NotificationEventRepository } from '../repositories/notification-event.repository';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';
import { QuietHoursRepository, QuietHoursRow } from '../repositories/quiet-hours.repository';
import { NotificationEventNotFoundError, CannotOptOutError } from '../domain/communication.errors';

export interface PrefInput { eventCode: string; channel: string; isEnabled: boolean; }

@Injectable()
export class PreferenceService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly events: NotificationEventRepository,
    private readonly prefs: NotificationPreferenceRepository,
    private readonly quiet: QuietHoursRepository,
  ) {}

  async list(userId: string) { return (await this.prefs.listForUser(userId)).map((p) => p.toJSON()); }

  async setPreferences(tenantId: string, userId: string, items: PrefInput[]) {
    // validate against the catalog BEFORE any write (fail-closed)
    for (const it of items) {
      if (it.isEnabled) continue;                          // enabling is always allowed
      const event = await this.events.getByCode(it.eventCode);
      if (!event) throw new NotificationEventNotFoundError(it.eventCode);
      if (!event.userCanOptOut) throw new CannotOptOutError(it.eventCode);   // mandatory event — cannot disable
    }
    return this.uow.run(tenantId, async (tx) => {
      await this.prefs.upsertMany(tx, userId, items);
      await this.outbox.write(tx, { tenantId, aggregateType: 'notification_preference', aggregateId: userId, eventType: CommEventType.PreferenceUpdated, payload: { v: 1, userId, count: items.length } });
      return { updated: items.length };
    }, { userId });
  }

  async getQuietHours(userId: string) { return this.quiet.getForUser(userId); }
  async setQuietHours(tenantId: string, userId: string, q: QuietHoursRow) {
    return this.uow.run(tenantId, async (tx) => { await this.quiet.upsert(tx, userId, q); return q; }, { userId });
  }
}
