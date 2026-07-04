// modules/payments/read-models/saved-instruments.read-model.ts
// CQRS read of the caller's OWN saved payment instruments (P0-4) — served from the replica (Law 12),
// tenant-scoped via forTenant (RLS is the net), and always the authenticated caller's own rows (no userId
// param, no IDOR). NOTHING sensitive is returned: UPI handles are masked (ab***@psp), bank accounts show
// only the last 4 digits + IFSC bank code (the full number is never stored — only account_last4 + a
// gateway vault_ref token). Two sources: live UPI-AutoPay mandates (upi_mandates) and tokenised payout
// instruments (bank_accounts).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';

/** Mask a stored UPI id leniently to "ab***@psp" (keeps ≤2 leading chars; tolerates non-strict handles). */
function maskUpi(raw: string | null): string | null {
  if (!raw) return null;
  const at = raw.indexOf('@');
  if (at <= 0) return '***';
  const head = raw.slice(0, Math.min(2, at));
  return `${head}***${raw.slice(at)}`;
}

export interface SavedMandateInstrument {
  kind: 'upi_autopay';
  id: string; handleMasked: string; status: string; purpose: string;
  maxAmountMinor: string; currencyCode: string;
}
export interface SavedBankInstrument {
  kind: 'bank' | 'upi';
  id: string; last4: string | null; ifsc: string | null; upiMasked: string | null;
  holderName: string | null; isPrimary: boolean; verified: boolean;
}
export interface SavedInstrumentsView {
  mandates: SavedMandateInstrument[];
  accounts: SavedBankInstrument[];
}

@Injectable()
export class SavedInstrumentsReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async forUser(tenantId: string, userId: string): Promise<SavedInstrumentsView> {
    const db = this.replica.forTenant(tenantId);
    const [m, b] = await Promise.all([
      db.query(
        `SELECT id, vpa_masked, status, purpose, max_amount_minor::text AS max_amount_minor, currency_code
           FROM upi_mandates
          WHERE tenant_id=$1 AND user_id=$2 AND status IN ('pending','active','paused') AND deleted_at IS NULL
          ORDER BY created_at DESC, id DESC LIMIT 50`, [tenantId, userId]),
      db.query(
        `SELECT id, account_kind, account_last4, ifsc, upi_id, holder_name, is_primary, penny_verified_at
           FROM bank_accounts
          WHERE user_id=$1 AND deleted_at IS NULL
          ORDER BY is_primary DESC, created_at DESC LIMIT 50`, [userId]),
    ]);
    return {
      mandates: m.rows.map((r: any): SavedMandateInstrument => ({
        kind: 'upi_autopay', id: r.id, handleMasked: r.vpa_masked, status: r.status, purpose: r.purpose,
        maxAmountMinor: r.max_amount_minor, currencyCode: r.currency_code,
      })),
      accounts: b.rows.map((r: any): SavedBankInstrument => ({
        kind: r.account_kind === 'upi' ? 'upi' : 'bank',
        id: r.id, last4: r.account_last4 ?? null, ifsc: r.ifsc ?? null,
        upiMasked: maskUpi(r.upi_id ?? null), holderName: r.holder_name ?? null,
        isPrimary: r.is_primary === true, verified: r.penny_verified_at != null,
      })),
    };
  }
}
