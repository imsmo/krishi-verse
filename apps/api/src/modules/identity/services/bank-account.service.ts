// modules/identity/services/bank-account.service.ts · tokenised payout destinations (owner-scoped).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';
import { BankAccount } from '../domain/bank-account.entity';
import { BankAccountRepository } from '../repositories/bank-account.repository';
import { CreateBankAccountDto } from '../dto/create-bank-account.dto';

@Injectable()
export class BankAccountService {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, private readonly repo: BankAccountRepository) {}
  async add(tenantId: string, userId: string, dto: CreateBankAccountDto) {
    const id = await this.uow.run(tenantId, async (tx) => {
      if (dto.isPrimary) await this.repo.unsetPrimary(tx, userId);
      const b = BankAccount.create({ id: uuidv7(), userId, tenantId: null, accountKind: dto.accountKind, upiId: dto.upiId ?? null, accountLast4: dto.accountLast4 ?? null, ifsc: dto.ifsc ?? null, holderName: dto.holderName ?? null, vaultRef: dto.vaultRef, isPrimary: dto.isPrimary });
      await this.repo.insert(tx, b);
      return b.id;
    }, { userId });
    return { id };
  }
  list(tenantId: string, userId: string) { return this.repo.listByUser(tenantId, userId).then((rows) => rows.map((b) => b.toPublic())); }
}
