// modules/identity/gateway/fund-account-tokeniser.port.ts
// Port to the EXTERNAL payout gateway's FUND-ACCOUNT vault (RazorpayX-style). Turns a raw bank account
// (account number + IFSC + holder) into an opaque VAULT REF (the gateway's fund_account_id) used later for payouts.
// CONTRACT, non-negotiable (Law: never store raw bank — only vault refs + last-4):
//   • the RAW account number is passed to tokeniseBank() and goes NO FURTHER than the adapter — never persisted,
//     never logged, never returned to the client.
//   • the gateway returns a VAULT REF + we keep ONLY that + the last-4 (for display).
//   • adapters are resilience-wrapped and DEGRADE (throw a typed FundAccountError) rather than hang (Law 12).
import { AppError } from '../../../shared/errors/app-error';

export const FUND_ACCOUNT_TOKENISER = Symbol('FUND_ACCOUNT_TOKENISER');

export interface TokeniseBankInput {
  accountNumber: string;   // RAW — adapter-only, never persisted/logged
  ifsc: string;
  holderName: string;
}
export interface TokeniseResult {
  vaultRef: string;        // opaque gateway fund_account_id (what we persist)
  last4: string;           // last 4 of the account number (display/audit only)
}

export interface FundAccountTokeniser {
  readonly providerCode: string;
  tokeniseBank(input: TokeniseBankInput): Promise<TokeniseResult>;
}

export class FundAccountError extends AppError {
  constructor(message = 'Bank tokenisation failed', retryable = false) {
    super('FUND_ACCOUNT_TOKENISE_FAILED', message, 502, undefined, retryable);
  }
}
