// modules/communication/gateway/noop-masking.gateway.ts · default masking provider when none is configured.
// Dev/test: returns a synthetic call ref so flows can be exercised; prod: warns + fails (nothing silently lost).
import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { MaskingProvider, BridgeInput, BridgeResult } from './masking-provider.port';

@Injectable()
export class NoopMaskingGateway implements MaskingProvider {
  readonly providerCode = 'noop';
  private readonly log = new Logger('MaskingProvider');
  constructor(private readonly config: AppConfig) {}
  async bridge(input: BridgeInput): Promise<BridgeResult> {
    if (this.config.isProd) { this.log.warn('masking provider not configured; call dropped'); return { ok: false, failureReason: 'provider_not_configured' }; }
    return { ok: true, providerCallRef: `dev-call-${input.idempotencyKey}` };
  }
}
