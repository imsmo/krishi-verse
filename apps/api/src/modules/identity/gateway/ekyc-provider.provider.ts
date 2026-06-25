// modules/identity/gateway/ekyc-provider.provider.ts · binds EKYC_PROVIDER by config.
// EKYC_PROVIDER_KIND='sandbox' (dev/test only — accepts a fixed OTP) → SandboxEkycProvider; otherwise the
// resilience-wrapped HTTP adapter to the real provider. assertProductionSecurity REFUSES to boot in prod when
// the kind is 'sandbox' (no identity backdoor), so the sandbox can only ever run in dev/test. Swapping the
// provider is config, not code.
import { Provider } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { EKYC_PROVIDER } from './ekyc-provider.port';
import { SandboxEkycProvider } from './sandbox-ekyc.provider';
import { HttpEkycProvider } from './http-ekyc.provider';

export const ekycProviderProvider: Provider = {
  provide: EKYC_PROVIDER,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const e = config.ekyc;
    if (e.kind === 'sandbox') return new SandboxEkycProvider();
    return new HttpEkycProvider({ baseUrl: e.baseUrl, apiKey: e.apiKey }, resilience);
  },
};
