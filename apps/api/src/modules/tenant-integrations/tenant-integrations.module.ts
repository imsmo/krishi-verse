// modules/tenant-integrations/tenant-integrations.module.ts · tenant self-serve third-party integrations (P1-11).
// A tenant connects its OWN provider credentials (Razorpay sub-account, MSG91, …); the raw secret is vaulted via
// the SecretWriter port and only the opaque ref is persisted (Law: never store raw provider secrets). Gated by the
// `tenancy` feature flag + tenant.settings permission (NOT god-mode — Law 11). The SecretWriter binding fails CLOSED
// in production: prod MUST be configured with the AWS backend or boot crashes (no dev no-op vault in prod).
import { Module } from '@nestjs/common';
import { AppConfig } from '../../core/config/app-config';
import { RESILIENCE, ResilienceService } from '../../core/resilience/resilience.service';
import { SECRET_WRITER } from '../../core/secrets/secret-writer.port';
import { LocalSecretWriter } from '../../core/secrets/local-secret-writer';
import { AwsSecretWriter } from '../../core/secrets/aws-secret-writer';
import { IntegrationsController } from './controllers/v1/integrations.controller';
import { TenantIntegrationService } from './services/tenant-integration.service';
import { TenantIntegrationRepository } from './repositories/tenant-integration.repository';

@Module({
  controllers: [IntegrationsController],
  providers: [
    TenantIntegrationService,
    TenantIntegrationRepository,
    {
      provide: SECRET_WRITER,
      inject: [AppConfig, RESILIENCE],
      useFactory: (config: AppConfig, resilience: ResilienceService) => {
        const { backend, region, prefix } = config.integrationSecrets;
        if (backend === 'aws') return new AwsSecretWriter({ region, prefix }, resilience);
        // Fail CLOSED: the dev no-op vault must NEVER run in production.
        if (config.isProd) {
          throw new Error('INTEGRATION_SECRETS_BACKEND must be "aws" in production — refusing to use the local no-op vault for tenant credentials');
        }
        return new LocalSecretWriter();
      },
    },
  ],
  exports: [TenantIntegrationService],
})
export class TenantIntegrationsModule {}
