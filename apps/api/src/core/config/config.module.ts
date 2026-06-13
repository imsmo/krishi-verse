// core/config/config.module.ts
// Global module exposing the validated, typed AppConfig. AppConfig is the ONLY
// place process.env is read; everything else injects it (mockable in tests).
import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class ConfigModule {}
