// modules/identity/gateway/sandbox-fund-account.provider.ts · DEV/TEST-ONLY fund-account tokeniser.
// Returns a deterministic local token so the bank-add flow is exercisable without a real gateway. It NEVER runs in
// production: the factory binds the real adapter there, and assertProductionSecurity refuses to boot with the
// sandbox kind. Belt-and-braces, the constructor also throws if it's somehow instantiated in production.
import { FundAccountTokeniser, TokeniseBankInput, TokeniseResult, FundAccountError } from './fund-account-tokeniser.port';

export class SandboxFundAccountTokeniser implements FundAccountTokeniser {
  readonly providerCode = 'sandbox';
  constructor(isProduction: boolean) {
    if (isProduction) throw new FundAccountError('sandbox fund-account tokeniser must never run in production');
  }
  async tokeniseBank(input: TokeniseBankInput): Promise<TokeniseResult> {
    const last4 = input.accountNumber.slice(-4);
    // Deterministic dev token; the raw number is NOT embedded (only last4 + a hashless marker).
    return { vaultRef: `fa_sandbox_${input.ifsc}_${last4}`, last4 };
  }
}
