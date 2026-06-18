// modules/tenancy/tenancy.module.ts
// Tenancy (PRD §5 — the SaaS plans/subscriptions/quota foundation). Owns the GLOBAL plan catalogue
// (plans + plan_limits; platform-admin only — Law 11) and tenant SUBSCRIPTIONS: an ACTIVE subscription is
// exactly what core QuotaService resolves a tenant's plan_limits from, so building this makes quota
// enforcement real. GET /subscriptions/current is the quota dashboard (limits + current usage). Gated by
// the `tenancy` feature flag (default OFF).
//
// SCOPE: this build ships the plans + subscriptions spine (the quota foundation). Tenant CRUD/settings/
// custom-domains/feature-toggles and SaaS BILLING (saas_invoices, dunning, auto-renew) are deferred
// (their scaffolds are left unwired) — the subscription's price is recorded but not collected here.
import { Module } from '@nestjs/common';
import { PlansController } from './controllers/v1/plans.controller';
import { SubscriptionsController } from './controllers/v1/subscriptions.controller';
import { PlanService } from './services/plan.service';
import { SubscriptionService } from './services/subscription.service';
import { PlanRepository } from './repositories/plan.repository';
import { SubscriptionRepository } from './repositories/subscription.repository';

// The expiry worker job (jobs/grace-period.job.ts) is instantiated by apps/worker with a privileged
// kv_relay Pool — not a DI provider (it takes a Pool), mirroring the other expiry jobs.
@Module({
  controllers: [PlansController, SubscriptionsController],
  providers: [PlanService, SubscriptionService, PlanRepository, SubscriptionRepository],
  exports: [PlanService, SubscriptionService],
})
export class TenancyModule {}
