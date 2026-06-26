// modules/identity/gateway/fund-account-tokeniser.provider.ts · binds FUND_ACCOUNT_TOKENISER by config.
// BANK_VAULT_KIND='sandbox' (dev/test only) → SandboxFundAccountTokeniser; otherwise the resilience-wrapped
// RazorpayX adapter (reuses the RAZORPAYX_* credentials). assertProductionSecurity REFUSES to boot in prod when
// the kind is 'sandbox' (no bank-vault backdoor). Swapping the provider is config, not code.
import { Provider } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { FUND_ACCOUNT_TOKENISER } from './fund-account-tokeniser.port';
import { SandboxFundAccountTokeniser } from './sandbox-fund-account.provider';
import { RazorpayXFundAccountTokeniser } from './razorpayx-fund-account.provider';

export const fundAccountTokeniserProvider: Provider = {
  provide: FUND_ACCOUNT_TOKENISER,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const v = config.bankVault;
    if (v.kind === 'sandbox') return new SandboxFundAccountTokeniser(config.nodeEnv === 'production');
    return new RazorpayXFundAccountTokeniser({ keyId: v.keyId, keySecret: v.keySecret, baseUrl: v.baseUrl }, resilience);
  },
};
