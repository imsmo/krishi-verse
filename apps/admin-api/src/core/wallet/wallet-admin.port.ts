// apps/admin-api/src/core/wallet/wallet-admin.port.ts · THE money boundary for the god-mode plane (Law 2/9).
// admin-api NEVER inserts ledger/wallet rows itself. When a billing operator applies a manual adjustment, the
// money moves by calling the wallet-service over its gRPC contract (apps/wallet-service/src/grpc/wallet.proto) —
// the ONLY writer of money on the platform. This is the injectable seam: the production binding is the gRPC
// client (wallet-grpc.client.ts); unit tests bind a fake. Every post is a balanced, double-entry transaction
// (signed legs summing to ZERO) and is idempotent on idempotencyKey (replay never double-posts).
export const WALLET_ADMIN = Symbol('WALLET_ADMIN');

/** One signed leg of a transaction. amountMinor is signed minor units: positive = credit, negative = debit. */
export interface AdjustmentLeg {
  ownerKind: 'user' | 'tenant' | 'platform';
  ownerId?: string;          // tenant id / user id; omitted for platform legs
  accountCode: string;       // main | commission | promo_liability | suspense | ...
  amountMinor: bigint;       // signed; NEVER a JS number (Law 2)
}

export interface PostAdjustmentInput {
  tenantId: string;
  txnType: string;           // lookup 'ledger_txn_type' code, e.g. 'billing_adjustment'
  idempotencyKey: string;    // REQUIRED (Law 3) — replay returns the same txn
  legs: AdjustmentLeg[];     // ≥2 legs, single currency, sum to zero
  currencyCode: string;
  referenceType?: string;
  referenceId?: string;
  initiatedBy?: string;      // actor admin user id (audit)
  description?: string;
}

export interface PostAdjustmentResult { txnId: string; alreadyApplied: boolean; }

export interface WalletAdminPort {
  /** Post a balanced double-entry transaction via the wallet-service. Idempotent on idempotencyKey. */
  post(input: PostAdjustmentInput): Promise<PostAdjustmentResult>;
}
