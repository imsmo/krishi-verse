// apps/api/src/app.module.ts · ROOT WIRING
// Order matters: core plumbing first, then business modules. A module not
// imported here does not exist at runtime — this file IS the tree's trunk.
// Phase 1 wires the listings vertical slice end-to-end; the remaining PRD
// modules are added here one by one as they are implemented (copy listings).
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { RequestIdMiddleware } from './core/http/request-id.middleware';
import { TenantContextMiddleware } from './core/tenancy-context/tenant-context.middleware';
import { ListingsModule } from './modules/listings/listings.module';

@Module({
  imports: [CoreModule, ListingsModule],
})
export class AppModule implements NestModule {
  // request-id THEN tenant-context (Law 1) on every route.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, TenantContextMiddleware).forRoutes('*');
  }
}
