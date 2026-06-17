// core/core.module.ts
// THE platform plumbing module. Global, imported once by AppModule. It binds
// every abstract infrastructure contract to its concrete implementation so that
// business modules depend only on tokens (UNIT_OF_WORK, OUTBOX_WRITER, …) and
// never on `pg`, Redis, etc. Swapping an implementation (e.g. OpenSearch search,
// Kafka outbox) is a one-line change here — no module rewrites.
import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { SearchModule } from './search/search.module';
import { AuditModule } from './audit/audit.module';
import { FeatureFlagsModule } from './feature-flags/flags.module';
import { I18nModule } from './i18n/i18n.module';
import { RateLimitGuard } from './http/rate-limit.guard';

import { TokenService, TOKEN_SERVICE } from './auth/token.service';
import { OtpService, OTP_SERVICE, SMS_SENDER, SmsSender } from './auth/otp.service';
import { RefreshTokenService } from './auth/refresh-token.service';
import { NoopSmsSender } from './auth/sms.noop';
import { RoleCacheService, ROLE_CACHE_SERVICE } from './rbac/role-cache.service';

import { OUTBOX_WRITER } from './outbox/outbox.writer';
import { PgOutboxWriter } from './outbox/outbox.writer.pg';
import { OutboxHandlerRegistry } from './outbox/outbox.dispatcher';
import { OUTBOX_HANDLER_REGISTRY } from './outbox/event-envelope';
import { QUOTA_SERVICE } from './quota/quota.service';
import { PgQuotaService } from './quota/quota.service.pg';
import { IDEMPOTENCY_SERVICE } from './idempotency/idempotency.service';
import { PgIdempotencyService } from './idempotency/idempotency.service.pg';
import { METRICS } from './observability/metrics';
import { ResilienceService, RESILIENCE } from './resilience/resilience.service';
import { WALLET_SERVICE } from './wallet/wallet.port';
import { InProcessWalletClient } from './wallet/wallet.client.inprocess';
import { LedgerRepository } from './wallet/ledger.repository';
import { ReconciliationService } from './wallet/reconciliation.service';
import { PromMetrics } from './observability/metrics.prom';

import { AuthGuard } from './auth/auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { TenantResolver } from './tenancy-context/tenant-resolver';
import { TenantContextMiddleware } from './tenancy-context/tenant-context.middleware';
import { RequestIdMiddleware } from './http/request-id.middleware';
import { AllExceptionsFilter } from './http/exception.filter';
import { ResponseInterceptor } from './http/response.interceptor';

import { HealthController } from './health/health.controller';
import { MetricsController } from './observability/metrics.controller';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, CacheModule, SearchModule, AuditModule, FeatureFlagsModule, I18nModule],
  controllers: [HealthController, MetricsController],
  providers: [
    { provide: OUTBOX_WRITER, useClass: PgOutboxWriter },
    { provide: QUOTA_SERVICE, useClass: PgQuotaService },
    { provide: IDEMPOTENCY_SERVICE, useClass: PgIdempotencyService },
    PromMetrics,
    { provide: METRICS, useExisting: PromMetrics },
    ResilienceService, { provide: RESILIENCE, useExisting: ResilienceService },
    LedgerRepository, InProcessWalletClient, { provide: WALLET_SERVICE, useExisting: InProcessWalletClient },
    ReconciliationService,
    OutboxHandlerRegistry, { provide: OUTBOX_HANDLER_REGISTRY, useExisting: OutboxHandlerRegistry },
    AuthGuard, PermissionsGuard,
    TenantResolver, TenantContextMiddleware, RequestIdMiddleware,
    // auth + RBAC platform services (used by the identity module's auth flow)
    TokenService, { provide: TOKEN_SERVICE, useExisting: TokenService },
    OtpService, { provide: OTP_SERVICE, useExisting: OtpService },
    RefreshTokenService,
    RoleCacheService, { provide: ROLE_CACHE_SERVICE, useExisting: RoleCacheService },
    { provide: SMS_SENDER, useClass: NoopSmsSender },
    // global error envelope + success envelope
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: RateLimitGuard },  // global edge rate limit (per-route @RateLimit overrides)
  ],
  exports: [
    OUTBOX_WRITER, QUOTA_SERVICE, IDEMPOTENCY_SERVICE, METRICS, PromMetrics,
    ResilienceService, RESILIENCE,
    WALLET_SERVICE, InProcessWalletClient, LedgerRepository, ReconciliationService,
    OutboxHandlerRegistry, OUTBOX_HANDLER_REGISTRY,
    AuthGuard, PermissionsGuard, TenantResolver, TenantContextMiddleware, RequestIdMiddleware,
    TokenService, TOKEN_SERVICE, OtpService, OTP_SERVICE, RefreshTokenService,
    RoleCacheService, ROLE_CACHE_SERVICE, SMS_SENDER,
    ConfigModule, DatabaseModule, CacheModule, SearchModule, AuditModule, FeatureFlagsModule, I18nModule,
  ],
})
export class CoreModule {}
