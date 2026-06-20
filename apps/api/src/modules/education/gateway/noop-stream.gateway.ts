// modules/education/gateway/noop-stream.gateway.ts · default stream provider when none is configured.
// Dev/test: returns a synthetic stream ref + playback URL so flows can be exercised; prod: warns + fails.
import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { StreamProvider, CreateStreamInput, CreateStreamResult } from './stream-provider.port';

@Injectable()
export class NoopStreamGateway implements StreamProvider {
  readonly providerCode = 'noop';
  private readonly log = new Logger('StreamProvider');
  constructor(private readonly config: AppConfig) {}
  async createStream(input: CreateStreamInput): Promise<CreateStreamResult> {
    if (this.config.isProd) { this.log.warn('stream provider not configured; cannot go live'); return { ok: false, failureReason: 'provider_not_configured' }; }
    return { ok: true, providerStreamRef: `dev-stream-${input.idempotencyKey}`, playbackUrl: `https://dev.local/play/${input.sessionId}` };
  }
}
