// modules/identity/identity.module.ts
// Wires the identity bounded context. Core auth/RBAC/audit services are provided
// globally by CoreModule and injected by token/class. Other modules depend only on
// the public services exported here (Law 11: never on repositories).
import { Module } from '@nestjs/common';

// Controllers (HTTP edge)
import { AuthController } from './controllers/v1/auth.controller';
import { UsersController } from './controllers/v1/users.controller';
import { RolesController } from './controllers/v1/roles.controller';
import { KycController } from './controllers/v1/kyc.controller';
import { AddressesController } from './controllers/v1/addresses.controller';
import { BankAccountsController } from './controllers/v1/bank-accounts.controller';
import { ConsentsController } from './controllers/v1/consents.controller';

// Services
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { UserTenantRoleService } from './services/user-tenant-role.service';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { KycDocumentService } from './services/kyc-document.service';
import { EkycService } from './services/ekyc.service';
import { ekycProviderProvider } from './gateway/ekyc-provider.provider';
import { fundAccountTokeniserProvider } from './gateway/fund-account-tokeniser.provider';
import { AddressService } from './services/address.service';
import { BankAccountService } from './services/bank-account.service';
import { ConsentService } from './services/consent.service';
import { SessionService } from './services/session.service';
import { PrivacyService } from './services/privacy.service';
import { ChangePhoneService } from './services/change-phone.service';
import { PrivacyController } from './controllers/v1/privacy.controller';

// Repositories
import { UserRepository } from './repositories/user.repository';
import { RoleRepository } from './repositories/role.repository';
import { PermissionRepository } from './repositories/permission.repository';
import { UserTenantRoleRepository } from './repositories/user-tenant-role.repository';
import { KycDocumentRepository } from './repositories/kyc-document.repository';
import { EkycSessionRepository } from './repositories/ekyc-session.repository';
import { AddressRepository } from './repositories/address.repository';
import { BankAccountRepository } from './repositories/bank-account.repository';
import { DeviceRepository } from './repositories/device.repository';
import { SessionRepository } from './repositories/session.repository';
import { LoginEventRepository } from './repositories/login-event.repository';
import { ConsentRepository } from './repositories/consent.repository';
import { DataSubjectRequestRepository } from './repositories/data-subject-request.repository';
import { RiskScoreRepository } from './repositories/risk-score.repository';

// Event handlers + jobs (run in worker; registered so DI resolves their deps)
import { OrderCompletedHandler } from './events/handlers/order-completed.handler';
import { DisputeResolvedHandler } from './events/handlers/dispute-resolved.handler';
import { KycExpiryRemindersJob } from './jobs/kyc-expiry-reminders.job';
import { DpdpErasureCoolingJob } from './jobs/dpdp-erasure-cooling.job';
import { RiskScoreRecomputeJob } from './jobs/risk-score-recompute.job';

@Module({
  controllers: [AuthController, UsersController, RolesController, KycController, AddressesController, BankAccountsController, ConsentsController, PrivacyController],
  providers: [
    AuthService, UserService, UserTenantRoleService, RoleService, PermissionService,
    KycDocumentService, EkycService, AddressService, BankAccountService, ConsentService, SessionService, PrivacyService, ChangePhoneService,
    ekycProviderProvider,
    fundAccountTokeniserProvider,
    UserRepository, RoleRepository, PermissionRepository, UserTenantRoleRepository, KycDocumentRepository, EkycSessionRepository,
    AddressRepository, BankAccountRepository, DeviceRepository, SessionRepository, LoginEventRepository,
    ConsentRepository, DataSubjectRequestRepository, RiskScoreRepository,
    OrderCompletedHandler, DisputeResolvedHandler,
    KycExpiryRemindersJob, DpdpErasureCoolingJob, RiskScoreRecomputeJob,
  ],
  // public surface for other modules (Law 11): services + cross-module event handlers + jobs
  exports: [
    UserService, ConsentService, UserTenantRoleService, RoleService, PermissionService, KycDocumentService,
    OrderCompletedHandler, DisputeResolvedHandler,
    KycExpiryRemindersJob, DpdpErasureCoolingJob, RiskScoreRecomputeJob,
  ],
})
export class IdentityModule {}
