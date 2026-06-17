// core/wallet/wallet.errors.ts · typed, stable-coded money errors.
import { AppError, DomainError } from '../../shared/errors/app-error';

/** The legs of a transaction did not sum to zero — would create/destroy money. HARD FAIL. */
export class LedgerNotBalancedError extends DomainError {
  constructor(sumMinor: bigint) { super('LEDGER_NOT_BALANCED', `Ledger legs must sum to zero (got ${sumMinor})`, 500, { sumMinor: sumMinor.toString() }); }
}
/** A debit would overdraw a non-platform account. */
export class InsufficientWalletBalanceError extends AppError {
  constructor(accountCode: string) { super('WALLET_INSUFFICIENT_BALANCE', `Insufficient balance in '${accountCode}'`, 409, { accountCode }); }
}
/** The account is frozen (fraud hold / legal) — no debits. */
export class WalletFrozenError extends AppError {
  constructor(accountCode: string) { super('WALLET_FROZEN', `Account '${accountCode}' is frozen`, 409, { accountCode }); }
}
/** Malformed transaction (mixed currencies, <2 legs, zero-amount leg). */
export class InvalidLedgerTxnError extends DomainError {
  constructor(message: string) { super('LEDGER_INVALID_TXN', message, 400); }
}
