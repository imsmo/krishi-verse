// modules/identity/repositories/bank-account.repository.ts · tokenised payout destinations.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { BankAccount } from '../domain/bank-account.entity';

const COLS = `id, user_id, tenant_id, account_kind, upi_id, account_last4, ifsc, holder_name, vault_ref, penny_verified_at, is_primary`;
const toDomain = (r: any): BankAccount => BankAccount.rehydrate({ id: r.id, userId: r.user_id, tenantId: r.tenant_id, accountKind: r.account_kind, upiId: r.upi_id, accountLast4: r.account_last4, ifsc: r.ifsc, holderName: r.holder_name, vaultRef: r.vault_ref, pennyVerifiedAt: r.penny_verified_at, isPrimary: r.is_primary });

@Injectable()
export class BankAccountRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, b: BankAccount): Promise<void> {
    const p = b.toProps();
    await tx.query(
      `INSERT INTO bank_accounts (${COLS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.id, p.userId, p.tenantId, p.accountKind, p.upiId, p.accountLast4, p.ifsc, p.holderName, p.vaultRef, p.pennyVerifiedAt, p.isPrimary]);
  }
  async unsetPrimary(tx: TxContext, userId: string): Promise<void> {
    await tx.query(`UPDATE bank_accounts SET is_primary=false WHERE user_id=$1 AND is_primary AND deleted_at IS NULL`, [userId]);
  }
  async listByUser(tenantId: string, userId: string): Promise<BankAccount[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM bank_accounts WHERE user_id=$1 AND deleted_at IS NULL ORDER BY is_primary DESC, created_at DESC`, [userId]);
    return r.rows.map(toDomain);
  }
}
