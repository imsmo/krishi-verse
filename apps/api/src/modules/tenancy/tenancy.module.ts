// modules/tenancy/tenancy.module.ts
// Tenancy (PRD §5 — the SaaS plans/subscriptions/quota foundation). Owns the GLOBAL plan catalogue
// (plans + plan_limits; platform-admin only — Law 11) and tenant SUBSCRIPTIONS: an ACTIVE subscription is
// exactly what core QuotaService resolves a tenant's plan_limits from, so building this makes quota
// enforcement real. GET /subscriptions/current is the quota dashboard (limits + current usage). Gated by
// the `tenancy` feature flag (default OFF).
//
// SCOPE: this build ships the plans + subscriptions spine (the quota foundation) AND the in-tenant SELF-SERVE
// plane (API-W3-05): a tenant admin views/edits its OWN tenant profile, submits onboarding for review, manages
// tenant-scoped settings + custom domains, and READS its feature overrides + usage. Tenant LIFECYCLE (status),
// feature GRANTS, and provisioning are god-mode and live in apps/admin-api tenant-ops (Law 11) — NOT here. SaaS
// BILLING (saas_invoices, dunning, auto-renew) remains deferred (its scaffolds are left unwired).
import { Module } from '@nestjs/common';
import { PlansController } from './controllers/v1/plans.controller';
import { SubscriptionsController } from './controllers/v1/subscriptions.controller';
import { TenantsController } from './controllers/v1/tenants.controller';
import { TenantSettingsController } from './controllers/v1/tenant-settings.controller';
import { PlanService } from './services/plan.service';
import { SubscriptionService } from './services/subscription.service';
import { TenantService } from './services/tenant.service';
import { TenantDomainService } from './services/tenant-domain.service';
import { PlanRepository } from './repositories/plan.repository';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { TenantRepository } from './repositories/tenant.repository';
import { TenantDomainRepository } from './repositories/tenant-domain.repository';
import { TenantSettingsRepository } from './repositories/tenant-settings.repository';
import { TenantFeatureRepository } from './repositories/tenant-feature.repository';
import { UsageCounterRepository } from './repositories/usage-counter.repository';

// The expiry worker job (jobs/grace-period.job.ts) is instantiated by apps/worker with a privileged
// kv_relay Pool — not a DI provider (it takes a Pool), mirroring the other expiry jobs.
@Module({
  controllers: [PlansController, SubscriptionsController, TenantsController, TenantSettingsController],
  providers: [
    PlanService, SubscriptionService, PlanRepository, SubscriptionRepository,
    TenantService, TenantDomainService,
    TenantRepository, TenantDomainRepository, TenantSettingsRepository, TenantFeatureRepository, UsageCounterRepository,
  ],
  exports: [PlanService, SubscriptionService, TenantService, TenantDomainService],
})
export class TenancyModule {}
