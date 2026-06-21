// apps/admin-api/src/modules/impersonation/impersonation.module.ts · the god-mode ACT-AS plane (Law 11) — the
// highest-sensitivity control. Owns short-lived, READ-ONLY, time-boxed impersonation grants + the exhaustive
// per-action audit. Kill-switch default OFF (Law 10, AdminConfig.IMPERSONATION_ENABLED). The act-as token is signed
// with a dedicated key and honoured by an impersonation-aware apps/api (see README integration note). Mounts under
// AdminCoreModule (auth/RBAC/FIDO2/step-up/audit are @Global).
import { Module } from '@nestjs/common';
import { ImpersonationController } from './impersonation.controller';
import { ImpersonationRepository } from './repositories/impersonation.repository';
import { StartImpersonationService } from './services/start-impersonation.service';
import { EndImpersonationService } from './services/end-impersonation.service';
import { ImpersonationHistoryService } from './services/impersonation-history.service';

@Module({
  controllers: [ImpersonationController],
  providers: [ImpersonationRepository, StartImpersonationService, EndImpersonationService, ImpersonationHistoryService],
})
export class ImpersonationModule {}
