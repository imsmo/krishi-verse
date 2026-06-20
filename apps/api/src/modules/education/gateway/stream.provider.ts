// modules/education/gateway/stream.provider.ts · binds STREAM_PROVIDER by config (HTTP adapter else noop).
import { Provider } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { STREAM_PROVIDER } from './stream-provider.port';
import { HttpStreamGateway } from './http-stream.gateway';
import { NoopStreamGateway } from './noop-stream.gateway';

export const streamProviderProvider: Provider = {
  provide: STREAM_PROVIDER,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const s = config.streaming;
    if (s.providerUrl) return new HttpStreamGateway({ baseUrl: s.providerUrl, apiKey: s.providerApiKey }, resilience);
    return new NoopStreamGateway(config);
  },
};
