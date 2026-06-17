// core/wallet/wallet.port.ts
// THE money boundary (Law 2). Business modules NEVER INSERT ledger rows — they call this port,
// which is the in-process implementation of the wallet-service's gRPC contract
// (apps/wallet-service/src/grpc/wallet.proto). Swapping to a network gRPC client at scale is a
// one-line CoreModule change; callers don't change.
//
// Every money movement is a balanced, double-entry transaction: a list of legs whose signed
// amounts (+credit / −debit) sum to ZERO. The port posts it atomically inside the caller's tx,
// is idempotent on `idempotencyKey`, and hash-chains each account's entries (tamper-evidence).
import { TxContext } from '../database/unit-of-work';
import { AccountRef } from './account-codes';

export const WALLET_SERVICE = Symbol('WALLET_SERVICE');

/** One side of a transaction. amountMinor is signed: positive = credit, negative = debit. */
export interface LedgerLeg { account: AccountRef; amountMinor: bigint; }

export interface PostTxnInput {
  /** Tenant the money-event belongs to (null only for pure platform-internal moves). */
  tenantId: string | null;
  /** lookup_values code under type 'ledger_txn_type' (e.g. 'order_payment','escrow_release'). */
  txnType: string;
  /** REQUIRED (Law 3): replaying the same key returns the same txn, never double-posts. */
  idempotencyKey: string;
  legs: LedgerLeg[];
  referenceType?: string;        // e.g. 'payment','order','payout'
  referenceId?: string;
  initiatedBy?: string;          // actor user id (audit)
  description?: string;
}

export interface PostTxnResult { txnId: string; alreadyApplied: boolean; }

export interface WalletPort {
  /** Post a balanced transaction within the caller's UoW tx. Idempotent on idempotencyKey. */
  post(tx: TxContext, input: PostTxnInput): Promise<PostTxnResult>;
  /** Current balance (minor units) of an account; 0 if it doesn't exist yet. Reads within the tx. */
  balanceMinor(tx: TxContext, account: AccountRef): Promise<bigint>;
}
