// core/core.module.ts
// THE platform plumbing module. Global, imported once by AppModule. It binds
// every abstract infrastructure contract to its concrete implementation so that
// business modules depend only on tokens (UNIT_OF_WORK, OUTBOX_WRITER, …) and
// never on `pg`, Redis, etc. Swapping an implementation (e.g. OpenSearch search,
// Kafka outbox) is a one-line change here — no module rewrites.
import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { SearchModule } from './search/search.module';

import { OUTBOX_WRITER } from './outbox/outbox.writer';
import { PgOutboxWriter } from './outbox/outbox.writer.pg';
import { QUOTA_SERVICE } from './quota/quota.service';
import { PgQuotaService } from './quota/quota.service.pg';
import { IDEMPOTENCY_SERVICE } from './idempotency/idempotency.service';
import { PgIdempotencyService } from './idempotency/idempotency.service.pg';
import { METRICS } from './observability/metrics';
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
  imports: [ConfigModule, DatabaseModule, CacheModule, SearchModule],
  controllers: [HealthController, MetricsController],
  providers: [
    { provide: OUTBOX_WRITER, useClass: PgOutboxWriter },
    { provide: QUOTA_SERVICE, useClass: PgQuotaService },
    { provide: IDEMPOTENCY_SERVICE, useClass: PgIdempotencyService },
    PromMetrics,
    { provide: METRICS, useExisting: PromMetrics },
    AuthGuard, PermissionsGuard,
    TenantResolver, TenantContextMiddleware, RequestIdMiddleware,
    // global error envelope + success envelope
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
  exports: [
    OUTBOX_WRITER, QUOTA_SERVICE, IDEMPOTENCY_SERVICE, METRICS, PromMetrics,
    AuthGuard, PermissionsGuard, TenantResolver, TenantContextMiddleware, RequestIdMiddleware,
    ConfigModule, DatabaseModule, CacheModule, SearchModule,
  ],
})
export class CoreModule {}
