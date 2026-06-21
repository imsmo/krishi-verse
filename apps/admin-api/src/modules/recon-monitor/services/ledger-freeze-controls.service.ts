// apps/admin-api/src/modules/recon-monitor/services/ledger-freeze-controls.service.ts · the emergency money-
// safety CONTROL: freeze/unfreeze a wallet account. A freeze flips wallet_accounts.is_frozen — the guard the
// wallet engine honours to REJECT further debits — and moves NO money (zero-sum untouched; this is NOT a ledger
// posting, Law 2/9). One ACID tx: lock the account FOR UPDATE → apply the freeze guard (no-op rejected as 409)
// → set is_frozen + freeze_reason → append an account_freeze_orders history row → write the audit_log row. The
// most consequential god-mode action here, so the controller gates it with owner-perm + hardware-key + step-up.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ReconRepository } from '../repositories/recon.repository';
import { WalletAccountNotFoundError } from '../domain/recon-monitor.errors';
import { applyFreeze } from '../domain/account-freeze';
import { FreezeAccountDto } from '../dto/recon-monitor.dto';

@Injectable()
export class LedgerFreezeControlsService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ReconRepository) {}

  async setFreeze(actor: AdminRequestContext, accountId: string, dto: FreezeAccountDto) {
    return this.pool.withTx(async (client) => {
      const account = await this.repo.getAccountForUpdate(client, accountId);
      if (!account) throw new WalletAccountNotFoundError(accountId);
      const nextFrozen = applyFreeze(account.isFrozen, dto.action);     // throws InvalidFreezeStateError on no-op
      await this.repo.setFrozen(client, accountId, nextFrozen, dto.reason, actor.userId);   // NO ledger write
      await this.audit.write(client, {
        actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: nextFrozen ? 'wallet.account_frozen' : 'wallet.account_unfrozen',
        entityType: 'wallet_account', entityId: accountId,
        oldValue: { isFrozen: account.isFrozen }, newValue: { isFrozen: nextFrozen },
        reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null,
      });
      return { accountId, ownerKind: account.ownerKind, accountCode: account.accountCode, isFrozen: nextFrozen };
    });
  }
}
