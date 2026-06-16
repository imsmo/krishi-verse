// modules/identity/services/user.service.ts · user profile + lifecycle (admin status changes audited).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { UserNotFoundError } from '../domain/identity.errors';
import { User } from '../domain/user.entity';
import { UserStatus } from '../domain/user.state';
import { UserRepository } from '../repositories/user.repository';
import { UpdateUserDto } from '../dto/update-user.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { normalizePhoneE164 } from '../../../shared/utils/phone';
import { InvalidPhoneError } from '../domain/identity.errors';

@Injectable()
export class UserService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly audit: AuditWriter,
    private readonly users: UserRepository,
  ) {}

  async getById(tenantId: string, id: string) {
    const u = await this.users.findById(tenantId, id);
    if (!u) throw new UserNotFoundError(id);
    return u.toPublic();
  }

  async updateProfile(tenantId: string, userId: string, dto: UpdateUserDto) {
    await this.uow.run(tenantId, async (tx) => {
      const u = await this.users.getForUpdate(tx, userId);
      if (!u) throw new UserNotFoundError(userId);
      u.updateProfile(dto);
      await this.users.update(tx, u);
    }, { userId });
    return this.getById(tenantId, userId);
  }

  /** Ambassador/admin-assisted onboarding of a user who can't self-register. */
  async adminCreate(tenantId: string, actorUserId: string, dto: CreateUserDto, ip: string | null) {
    const phone = normalizePhoneE164(dto.phone);
    if (!phone) throw new InvalidPhoneError();
    const id = await this.uow.run(tenantId, async (tx) => {
      const existing = await this.users.getByPhoneForUpdate(tx, phone);
      if (existing) return existing.id;
      const u = User.register({ id: uuidv7(), phone, fullName: dto.fullName ?? null, languageCode: dto.languageCode, countryCode: dto.countryCode });
      await this.users.insert(tx, u);
      await this.flush(tx, u.id, u.pullEvents());
      await this.audit.write(tx, { tenantId, actorUserId, action: 'user.created_assisted', entityType: 'user', entityId: u.id, ip });
      return u.id;
    }, { userId: actorUserId });
    return this.getById(tenantId, id);
  }

  async changeStatus(tenantId: string, actorUserId: string, targetUserId: string, status: UserStatus, reason: string | null, ip: string | null) {
    await this.uow.run(tenantId, async (tx) => {
      const u = await this.users.getForUpdate(tx, targetUserId);
      if (!u) throw new UserNotFoundError(targetUserId);
      const from = u.toProps().status;
      u.changeStatus(status, actorUserId);
      await this.users.update(tx, u);
      await this.flush(tx, u.id, u.pullEvents());
      await this.audit.write(tx, { tenantId, actorUserId, action: 'user.status_changed', entityType: 'user', entityId: u.id, oldValue: { status: from }, newValue: { status }, reason, ip });
    }, { userId: actorUserId });
    return this.getById(tenantId, targetUserId);
  }

  private async flush(tx: TxContext, userId: string, events: { type: string; payload: Record<string, unknown> }[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId: null, aggregateType: 'user', aggregateId: userId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
