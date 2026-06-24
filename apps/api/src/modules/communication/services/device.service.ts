// modules/communication/services/device.service.ts · register / revoke a user's push device.
// Ownership is always the caller's own userId (never a client-supplied id) — no IDOR. Registration is
// naturally idempotent (unique-on-token upsert), so no Idempotency-Key is needed: re-posting the same
// token is a no-op re-stamp. No money, no state machine — a simple owner-scoped registry write.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { PushDevice } from '../domain/push-device.entity';
import { PushDeviceRepository } from '../repositories/push-device.repository';

@Injectable()
export class DeviceService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly devices: PushDeviceRepository,
  ) {}

  /** Register (or refresh) the caller's push token for this device. */
  async register(tenantId: string, userId: string, input: { platform: string; token: string }) {
    const device = PushDevice.register({ userId, platform: input.platform, token: input.token }); // domain validates
    await this.uow.run(tenantId, (tx) => this.devices.upsert(tx, device), { userId });
    return { ok: true, platform: device.props.platform };
  }

  /** Revoke the caller's token on logout. Idempotent: returns ok regardless of whether a row existed. */
  async revoke(tenantId: string, userId: string, token: string) {
    const affected = await this.uow.run(tenantId, (tx) => this.devices.deactivate(tx, userId, token), { userId });
    return { ok: true, revoked: affected > 0 };
  }
}
