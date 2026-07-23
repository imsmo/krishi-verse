// core/feature-flags/flags.module.ts · global feature-flag service + guard + the mobile remote-config endpoint.
import { Global, Module } from '@nestjs/common';
import { FlagsService, FLAGS_SERVICE } from './flags.service';
import { FeatureFlagGuard } from './flags.guard';
import { FlagsController } from './flags.controller';

@Global()
@Module({
  controllers: [FlagsController],
  providers: [FlagsService, { provide: FLAGS_SERVICE, useExisting: FlagsService }, FeatureFlagGuard],
  exports: [FlagsService, FLAGS_SERVICE, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
