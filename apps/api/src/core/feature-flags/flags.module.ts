// core/feature-flags/flags.module.ts · global feature-flag service + guard.
import { Global, Module } from '@nestjs/common';
import { FlagsService, FLAGS_SERVICE } from './flags.service';
import { FeatureFlagGuard } from './flags.guard';

@Global()
@Module({
  providers: [FlagsService, { provide: FLAGS_SERVICE, useExisting: FlagsService }, FeatureFlagGuard],
  exports: [FlagsService, FLAGS_SERVICE, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
