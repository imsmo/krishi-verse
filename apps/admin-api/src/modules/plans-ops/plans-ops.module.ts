// apps/admin-api/src/modules/plans-ops/plans-ops.module.ts · the god-mode SaaS PLAN-CATALOGUE plane (Law 11).
// Owns the GLOBAL plans / plan_features / plan_limits catalogue that billing-ops (subscriptions → invoices) and the
// tenant QuotaService (plan_limits via the active subscription) consume. Surfaces: plan CRUD + lifecycle
// (PlanCrudService), pricing + versioning/anchor deals (CustomPricingService), and feature/limit assignment
// (PlanAssignmentService). Mounts under AdminCoreModule (auth/RBAC/FIDO2/step-up/audit are @Global).
import { Module } from '@nestjs/common';
import { PlansOpsController } from './plans-ops.controller';
import { PlansRepository } from './repositories/plans.repository';
import { PlanCrudService } from './services/plan-crud.service';
import { CustomPricingService } from './services/custom-pricing.service';
import { PlanAssignmentService } from './services/plan-assignment.service';

@Module({
  controllers: [PlansOpsController],
  providers: [PlansRepository, PlanCrudService, CustomPricingService, PlanAssignmentService],
})
export class PlansOpsModule {}
