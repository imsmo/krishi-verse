// core/config/config.module.ts
// Global module exposing the validated, typed AppConfig. AppConfig is the ONLY
// place process.env is read; everything else injects it (mockable in tests).
import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

// AppConfig's constructor takes the raw env bag (defaulted to process.env) so tests can pass a mock. Nest can't
// inject that param (its type erases to Object), so AppConfig is provided via a factory that reads process.env —
// the single source of truth at runtime; tests still `new AppConfig(mockEnv)` directly.
@Global()
@Module({
  providers: [{ provide: AppConfig, useFactory: () => new AppConfig(process.env) }],
  exports: [AppConfig],
})
export class ConfigModule {}
