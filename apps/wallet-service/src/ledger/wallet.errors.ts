// apps/wallet-service/src/ledger/wallet.errors.ts · typed, stable-coded money errors (mirrors
// apps/api/src/core/wallet/wallet.errors.ts). Each carries a `code` + a gRPC status so the transport maps them
// to the right wire status without leaking internals. A balance/overdraw/frozen failure is a CLIENT error
// (FAILED_PRECONDITION); a not-balanced txn is an INTERNAL invariant breach (must never reach a client).
export class WalletError extends Error {
  constructor(public readonly code: string, message: string, public readonly grpcStatus: number, public readonly details: Record<string, unknown> = {}) {
    super(message); this.name = 'WalletError';
  }
}
// gRPC status codes (grpc-js status enum values) — kept as literals so this file needs no grpc import.
export const GRPC = { INVALID_ARGUMENT: 3, NOT_FOUND: 5, ALREADY_EXISTS: 6, FAILED_PRECONDITION: 9, INTERNAL: 13 } as const;

export class LedgerNotBalancedError extends WalletError { constructor(sumMinor: bigint) { super('LEDGER_NOT_BALANCED', `Ledger legs must sum to zero (got ${sumMinor})`, GRPC.INTERNAL, { sumMinor: sumMinor.toString() }); } }
export class InvalidLedgerTxnError extends WalletError { constructor(message: string) { super('LEDGER_INVALID_TXN', message, GRPC.INVALID_ARGUMENT); } }
export class UnknownTxnTypeError extends WalletError { constructor(t: string) { super('LEDGER_UNKNOWN_TXN_TYPE', `Unknown ledger_txn_type '${t}'`, GRPC.INVALID_ARGUMENT, { txnType: t }); } }
export class InsufficientWalletBalanceError extends WalletError { constructor(accountCode: string) { super('WALLET_INSUFFICIENT_BALANCE', `Insufficient balance in '${accountCode}'`, GRPC.FAILED_PRECONDITION, { accountCode }); } }
export class WalletFrozenError extends WalletError { constructor(accountCode: string) { super('WALLET_FROZEN', `Account '${accountCode}' is frozen`, GRPC.FAILED_PRECONDITION, { accountCode }); } }
