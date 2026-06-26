// modules/identity/gateway/razorpayx-fund-account.provider.ts · real fund-account tokeniser (RazorpayX).
// Creates a fund_account (the bank account, keyed to a contact) and returns its opaque id as the vault ref.
// Resilience-wrapped (timeout + breaker; NO money here, so a bounded retry is safe). The raw account number is
// sent to RazorpayX and goes no further — never persisted/logged on our side. Failures DEGRADE to a typed error.
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { FundAccountTokeniser, TokeniseBankInput, TokeniseResult, FundAccountError } from './fund-account-tokeniser.port';

const DEP = 'razorpayx_fund_account';

export interface RazorpayXFundAccountConfig { keyId: string; keySecret: string; baseUrl?: string; }

export class RazorpayXFundAccountTokeniser implements FundAccountTokeniser {
  readonly providerCode = 'razorpayx';
  constructor(private readonly cfg: RazorpayXFundAccountConfig, private readonly resilience: ResilienceService) {}

  async tokeniseBank(input: TokeniseBankInput): Promise<TokeniseResult> {
    const auth = 'Basic ' + Buffer.from(`${this.cfg.keyId}:${this.cfg.keySecret}`).toString('base64');
    const base = this.cfg.baseUrl ?? 'https://api.razorpay.com';
    return this.resilience.run(DEP, async () => {
      // 1) contact (idempotent-ish by name; RazorpayX dedups loosely — we don't store the contact id, only the FA ref)
      const contactRes = await fetch(`${base}/v1/contacts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: auth },
        body: JSON.stringify({ name: input.holderName, type: 'customer' }),
      });
      const contact = (await contactRes.json().catch(() => ({}))) as any;
      if (!contactRes.ok || !contact?.id) throw new FundAccountError(`contact create failed (${contactRes.status})`, contactRes.status >= 500);
      // 2) fund account (the bank account) → its id is our vault ref
      const faRes = await fetch(`${base}/v1/fund_accounts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: auth },
        body: JSON.stringify({
          contact_id: contact.id, account_type: 'bank_account',
          bank_account: { name: input.holderName, ifsc: input.ifsc, account_number: input.accountNumber },
        }),
      });
      const fa = (await faRes.json().catch(() => ({}))) as any;
      if (faRes.status === 400 || faRes.status === 422) throw new FundAccountError(fa?.error?.description ?? 'invalid bank account', false);
      if (!faRes.ok || !fa?.id) throw new FundAccountError(`fund account create failed (${faRes.status})`, faRes.status >= 500);
      return { vaultRef: String(fa.id), last4: input.accountNumber.slice(-4) };
    }, { retries: 1 });
  }
}
