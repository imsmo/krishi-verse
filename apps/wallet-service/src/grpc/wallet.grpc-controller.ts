// apps/wallet-service/src/grpc/wallet.grpc-controller.ts · the gRPC wire adapter (THIN — no business logic).
// Implements the Wallet service from wallet.proto: maps the proto request → the engine call (inside ONE wallet
// tx), maps the result back, and maps typed WalletErrors → the right gRPC status (never leaking internals). The
// proto is loaded with longs:String, so amount_minor arrives as a string and becomes a bigint here — money is
// NEVER a JS number (Law 2). This file imports @grpc/grpc-js (a declared dep, installed in CI/runtime).
import type { sendUnaryData, ServerUnaryCall, UntypedServiceImplementation } from '@grpc/grpc-js';
import { WalletPool } from '../core/database/pg-pool.provider';
import { PostTransactionService, LedgerLeg } from '../ledger/post-transaction.service';
import { AccountRef, WalletOwnerKind } from '../ledger/account-codes';
import { WalletError, GRPC, InvalidLedgerTxnError } from '../ledger/wallet.errors';

interface ProtoLeg { owner_kind: string; owner_id: string; account_code: string; currency_code: string; amount_minor: string; }
interface PostReq { tenant_id: string; txn_type: string; idempotency_key: string; legs: ProtoLeg[]; reference_type: string; reference_id: string; initiated_by: string; description: string; }
interface BalReq { owner_kind: string; owner_id: string; account_code: string; currency_code: string; }

function toAccountRef(owner_kind: string, owner_id: string, account_code: string, currency_code: string): AccountRef {
  const kind = owner_kind as WalletOwnerKind;
  if (kind !== 'user' && kind !== 'tenant' && kind !== 'platform') throw new InvalidLedgerTxnError(`bad owner_kind '${owner_kind}'`);
  return { kind, accountCode: account_code, currencyCode: currency_code || 'INR', userId: kind === 'user' ? owner_id : undefined, tenantId: kind === 'tenant' ? owner_id : undefined };
}
const emptyToNull = (s: string) => (s && s.length ? s : null);

/** Build the gRPC method handlers bound to the engine + pool. Returned object is added to the proto service. */
export function makeWalletHandlers(engine: PostTransactionService, pool: WalletPool): UntypedServiceImplementation {
  return {
    PostTransaction: (call: ServerUnaryCall<PostReq, unknown>, cb: sendUnaryData<{ txn_id: string; already_applied: boolean }>) => {
      const r = call.request;
      const work = async () => {
        const legs: LedgerLeg[] = (r.legs ?? []).map((l) => ({ account: toAccountRef(l.owner_kind, l.owner_id, l.account_code, l.currency_code), amountMinor: BigInt(l.amount_minor) }));
        return pool.withTx((tx) => engine.post(tx, {
          tenantId: emptyToNull(r.tenant_id), txnType: r.txn_type, idempotencyKey: r.idempotency_key, legs,
          referenceType: emptyToNull(r.reference_type), referenceId: emptyToNull(r.reference_id), initiatedBy: emptyToNull(r.initiated_by), description: emptyToNull(r.description),
        }));
      };
      work().then((res) => cb(null, { txn_id: res.txnId, already_applied: res.alreadyApplied })).catch((e) => cb(toGrpcError(e), null));
    },
    GetBalance: (call: ServerUnaryCall<BalReq, unknown>, cb: sendUnaryData<{ balance_minor: string }>) => {
      const r = call.request;
      pool.withTx((tx) => engine.balanceMinor(tx, toAccountRef(r.owner_kind, r.owner_id, r.account_code, r.currency_code)))
        .then((bal) => cb(null, { balance_minor: bal.toString() })).catch((e) => cb(toGrpcError(e), null));
    },
  };
}

function toGrpcError(e: unknown): { code: number; message: string; details: string } {
  if (e instanceof WalletError) return { code: e.grpcStatus, message: e.code, details: e.message };
  return { code: GRPC.INTERNAL, message: 'WALLET_INTERNAL', details: 'internal error' };   // never leak internals
}
