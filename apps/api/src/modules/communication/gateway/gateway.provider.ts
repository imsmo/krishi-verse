// modules/communication/gateway/gateway.provider.ts · binds NOTIFICATION_GATEWAY by config.
// If NOTIFY_GATEWAY_URL is set → the resilience-wrapped HTTP adapter to the external notification product;
// otherwise the noop gateway (dev accepts, prod drops + warns). Swapping/scaling the notifier is config, not code.
import { Provider } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { NOTIFICATION_GATEWAY } from './notification-gateway.port';
import { HttpNotificationGateway } from './http.gateway';
import { NoopNotificationGateway } from './noop.gateway';

export const notificationGatewayProvider: Provider = {
  provide: NOTIFICATION_GATEWAY,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const n = config.notifications;
    if (n.gatewayUrl) return new HttpNotificationGateway({ baseUrl: n.gatewayUrl, apiKey: n.gatewayApiKey }, resilience);
    return new NoopNotificationGateway(config);
  },
};

import { MASKING_PROVIDER } from './masking-provider.port';
import { HttpMaskingGateway } from './http-masking.gateway';
import { NoopMaskingGateway } from './noop-masking.gateway';

export const maskingProviderProvider: Provider = {
  provide: MASKING_PROVIDER,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const m = config.masking;
    if (m.providerUrl) return new HttpMaskingGateway({ baseUrl: m.providerUrl, apiKey: m.providerApiKey }, resilience);
    return new NoopMaskingGateway(config);
  },
};
