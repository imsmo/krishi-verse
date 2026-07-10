// modules/identity/services/bank-account.service.ts · tokenised payout destinations (owner-scoped).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { BankAccount } from '../domain/bank-account.entity';
import { BankAccountRepository } from '../repositories/bank-account.repository';
import { UserTenantRoleRepository } from '../repositories/user-tenant-role.repository';
import { CreateBankAccountDto } from '../dto/create-bank-account.dto';
import { TokeniseBankAccountDto } from '../dto/tokenise-bank-account.dto';
import { FUND_ACCOUNT_TOKENISER, FundAccountTokeniser } from '../gateway/fund-account-tokeniser.port';
import { BankAccountKycRequiredError } from '../domain/identity.errors';

@Injectable()
export class BankAccountService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(FUND_ACCOUNT_TOKENISER) private readonly tokeniser: FundAccountTokeniser,
    private readonly audit: AuditWriter,
    private readonly repo: BankAccountRepository,
    private readonly utr: UserTenantRoleRepository,
  ) {}
  /** KV-BL-067 follow-up: adding a NEW payout destination is gated on the caller holding
   *  kyc_status='verified' on any active role in this tenant — mirrors modules/payments'
   *  requestPayout gate (see payments.errors.KycRequiredError). Checked BEFORE any side effect
   *  (including the gateway tokenise call in addFullBankAccount below), never after. */
  async add(tenantId: string, userId: string, dto: CreateBankAccountDto) {
    if (!(await this.utr.callerKycVerified(tenantId, userId))) throw new BankAccountKycRequiredError();
    const id = await this.uow.run(tenantId, async (tx) => {
      if (dto.isPrimary) await this.repo.unsetPrimary(tx, userId);
      const b = BankAccount.create({ id: uuidv7(), userId, tenantId: null, accountKind: dto.accountKind, upiId: dto.upiId ?? null, accountLast4: dto.accountLast4 ?? null, ifsc: dto.ifsc ?? null, holderName: dto.holderName ?? null, vaultRef: dto.vaultRef, isPrimary: dto.isPrimary });
      await this.repo.insert(tx, b);
      return b.id;
    }, { userId });
    return { id };
  }

  /** P1-16 · add a FULL bank account: tokenise the raw account at the gateway FIRST (the raw number never touches
   *  our DB/logs), then persist ONLY the vault ref + last-4. Audited (no PII in the audit value — last4 only).
   *  KV-BL-067 follow-up: the KYC gate runs BEFORE the tokenise call — an unverified caller must never even
   *  reach the gateway (that call is itself a side effect: it mints a real vault token upstream). */
  async addFullBankAccount(tenantId: string, userId: string, dto: TokeniseBankAccountDto) {
    if (!(await this.utr.callerKycVerified(tenantId, userId))) throw new BankAccountKycRequiredError();
    const tok = await this.tokeniser.tokeniseBank({ accountNumber: dto.accountNumber, ifsc: dto.ifsc, holderName: dto.holderName });
    const id = await this.uow.run(tenantId, async (tx) => {
      if (dto.isPrimary) await this.repo.unsetPrimary(tx, userId);
      const b = BankAccount.create({ id: uuidv7(), userId, tenantId: null, accountKind: 'bank', upiId: null, accountLast4: tok.last4, ifsc: dto.ifsc, holderName: dto.holderName, vaultRef: tok.vaultRef, isPrimary: dto.isPrimary });
      await this.repo.insert(tx, b);
      // Audit the addition — NEVER the raw number; last4 + IFSC + provider only.
      await this.audit.write(tx, { tenantId, actorUserId: userId, action: 'identity.bank.tokenised', entityType: 'bank_account', entityId: b.id, newValue: { last4: tok.last4, ifsc: dto.ifsc, provider: this.tokeniser.providerCode }, ip: null });
      return b.id;
    }, { userId });
    return { id };
  }

  list(tenantId: string, userId: string) { return this.repo.listByUser(tenantId, userId).then((rows) => rows.map((b) => b.toPublic())); }
}
