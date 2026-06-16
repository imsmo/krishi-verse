// modules/identity/domain/bank-account.entity.ts · tokenised payout destination.
// The full account number / VPA is NEVER stored — only last4 + the gateway fund-account
// token (vault_ref). Penny-verification gates payouts (set by the payments flow).
import { DomainError } from '../../../shared/errors/app-error';
export interface BankAccountProps {
  id: string; userId: string | null; tenantId: string | null;
  accountKind: 'bank' | 'upi'; upiId: string | null; accountLast4: string | null;
  ifsc: string | null; holderName: string | null; vaultRef: string;
  pennyVerifiedAt: Date | null; isPrimary: boolean;
}
export class BankAccount {
  private constructor(private props: BankAccountProps) {}
  static create(input: Omit<BankAccountProps, 'pennyVerifiedAt' | 'isPrimary'> & { isPrimary?: boolean }): BankAccount {
    if (!input.vaultRef) throw new DomainError('BANK_INVALID', 'vault_ref (tokenised account) is required', 422);
    if (input.accountKind === 'upi' && !input.upiId) throw new DomainError('BANK_INVALID', 'upi_id required for UPI', 422);
    if (input.accountKind === 'bank' && (!input.ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(input.ifsc)))
      throw new DomainError('BANK_INVALID', 'valid IFSC required for bank account', 422);
    return new BankAccount({ ...input, pennyVerifiedAt: null, isPrimary: input.isPrimary ?? false });
  }
  static rehydrate(p: BankAccountProps): BankAccount { return new BankAccount(p); }
  get id() { return this.props.id; }
  toProps(): Readonly<BankAccountProps> { return Object.freeze({ ...this.props }); }
  toPublic() {
    const p = this.props;
    return { id: p.id, kind: p.accountKind, upiId: p.upiId, last4: p.accountLast4, ifsc: p.ifsc,
      holderName: p.holderName, verified: !!p.pennyVerifiedAt, isPrimary: p.isPrimary };
  }
  markVerified(now: Date = new Date()): void { this.props.pennyVerifiedAt = now; }
}
