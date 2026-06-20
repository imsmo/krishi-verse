// apps/admin-api/src/admin.module.ts · the god-mode plane root module (Law 11 — separate security realm from
// apps/api). Pulls in the @Global AdminCoreModule (config / kv_admin pool / admin-JWT auth / owner RBAC + FIDO2
// & step-up guards / in-tx audit + access interceptor), applies the IP-allowlist middleware to every route
// (defence in depth, before auth), and mounts the platform-ops modules. This session wires ai-models-ops; the
// other ops modules are scaffolded and mount here the same way as they're built.
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminCoreModule } from './core/admin-core.module';
import { IpAllowlistMiddleware } from './core/auth/ip-allowlist.middleware';
import { AiModelsOpsModule } from './modules/ai-models-ops/ai-models-ops.module';

@Module({
  imports: [AdminCoreModule, AiModelsOpsModule],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpAllowlistMiddleware).forRoutes('*');   // IP-restrict the entire god-mode plane
  }
}
