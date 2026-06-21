// apps/admin-api/src/modules/flags-ops/flags-ops.module.ts · the god-mode FEATURE-FLAG control plane (Law 10 +
// Law 11). Owns the GLOBAL feature_flags registry: create (default OFF), percent rollout + targeting, on/off, and
// the emergency KILL-SWITCH (disable + lock). The runtime evaluator (apps/api core/feature-flags) READS these
// flags; this plane is the only authorised WRITER, owner-perm + FIDO2 + step-up gated, every change audited +
// recorded in feature_flag_changes. Mounts under AdminCoreModule (auth/RBAC/FIDO2/step-up/audit are @Global).
import { Module } from '@nestjs/common';
import { FlagsOpsController } from './flags-ops.controller';
import { FlagsRepository } from './repositories/flags.repository';
import { GlobalFlagsService } from './services/global-flags.service';
import { KillSwitchService } from './services/kill-switch.service';
import { PercentRolloutService } from './services/percent-rollout.service';

@Module({
  controllers: [FlagsOpsController],
  providers: [FlagsRepository, GlobalFlagsService, KillSwitchService, PercentRolloutService],
})
export class FlagsOpsModule {}
