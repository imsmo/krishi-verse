// apps/admin-api/src/modules/plans-ops/plans-ops.controller.ts · god-mode SaaS plan-catalogue surface (Law 11).
// Every route: AdminAuthGuard + OwnerPermissionsGuard. MUTATIONS (create / lifecycle / pricing / version /
// feature / limit) additionally require HardwareKeyGuard (FIDO2) + StepUpReauthGuard — plan/price changes affect
// revenue + every tenant's entitlements, so they're consequential. validate (zod) → authorize (owner perm) →
// delegate ONLY. No business logic here. No money posting (plans are catalogue config; billing-ops moves money).
import { Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { PlanCrudService } from './services/plan-crud.service';
import { CustomPricingService } from './services/custom-pricing.service';
import { PlanAssignmentService } from './services/plan-assignment.service';
import {
  QueryPlansSchema, QueryPlansDto, QueryPlanHistorySchema, QueryPlanHistoryDto,
  CreatePlanSchema, CreatePlanDto, UpdatePlanLifecycleSchema, UpdatePlanLifecycleDto,
  SetPricingSchema, SetPricingDto, VersionPlanSchema, VersionPlanDto,
  SetFeatureSchema, SetFeatureDto, SetLimitSchema, SetLimitDto,
} from './dto/plans-ops.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'plans', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class PlansOpsController {
  constructor(
    private readonly plans: PlanCrudService,
    private readonly pricing: CustomPricingService,
    private readonly assignment: PlanAssignmentService,
  ) {}

  // ---- reads ----
  @Get() @RequireOwnerPermission(OwnerPermissions.PlansRead)
  list(@ZodQuery(QueryPlansSchema) q: QueryPlansDto) {
    return this.plans.list({ code: q.code, country: q.country, status: q.status, publicOnly: q.publicOnly === 'true', cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get('features') @RequireOwnerPermission(OwnerPermissions.PlansRead)
  features() { return this.assignment.featureCatalogue().then((res) => ({ data: res.items })); }

  @Get(':id') @RequireOwnerPermission(OwnerPermissions.PlansRead)
  get(@Param('id') id: string) { return this.plans.get(id).then((data) => ({ data })); }

  @Get(':id/history') @RequireOwnerPermission(OwnerPermissions.PlansRead)
  history(@Param('id') id: string, @ZodQuery(QueryPlanHistorySchema) q: QueryPlanHistoryDto) {
    return this.plans.history({ planId: id, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  // ---- mutations: hardware-key + step-up elevation required ----
  @Post() @RequireOwnerPermission(OwnerPermissions.PlansManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  create(@Req() req: any, @ZodBody(CreatePlanSchema) dto: CreatePlanDto) {
    return this.plans.create(admin(req), dto).then((data) => ({ data }));
  }
  @Patch(':id') @RequireOwnerPermission(OwnerPermissions.PlansManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  lifecycle(@Req() req: any, @Param('id') id: string, @ZodBody(UpdatePlanLifecycleSchema) dto: UpdatePlanLifecycleDto) {
    return this.plans.updateLifecycle(admin(req), id, dto).then((data) => ({ data }));
  }
  @Patch(':id/pricing') @RequireOwnerPermission(OwnerPermissions.PlansManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  setPricing(@Req() req: any, @Param('id') id: string, @ZodBody(SetPricingSchema) dto: SetPricingDto) {
    return this.pricing.setPrices(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post(':id/version') @RequireOwnerPermission(OwnerPermissions.PlansManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  version(@Req() req: any, @Param('id') id: string, @ZodBody(VersionPlanSchema) dto: VersionPlanDto) {
    return this.pricing.version(admin(req), id, dto).then((data) => ({ data }));
  }
  @Put(':id/features/:code') @RequireOwnerPermission(OwnerPermissions.PlansManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  setFeature(@Req() req: any, @Param('id') id: string, @Param('code') code: string, @ZodBody(SetFeatureSchema) dto: SetFeatureDto) {
    return this.assignment.setFeature(admin(req), id, code, dto).then((data) => ({ data }));
  }
  @Delete(':id/features/:code') @RequireOwnerPermission(OwnerPermissions.PlansManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  removeFeature(@Req() req: any, @Param('id') id: string, @Param('code') code: string, @ZodBody(SetFeatureSchema) dto: SetFeatureDto) {
    return this.assignment.removeFeature(admin(req), id, code, dto.reason).then((data) => ({ data }));
  }
  @Put(':id/limits/:code') @RequireOwnerPermission(OwnerPermissions.PlansManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  setLimit(@Req() req: any, @Param('id') id: string, @Param('code') code: string, @ZodBody(SetLimitSchema) dto: SetLimitDto) {
    return this.assignment.setLimit(admin(req), id, code, dto).then((data) => ({ data }));
  }
  @Delete(':id/limits/:code') @RequireOwnerPermission(OwnerPermissions.PlansManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  removeLimit(@Req() req: any, @Param('id') id: string, @Param('code') code: string, @ZodBody(SetLimitSchema) dto: SetLimitDto) {
    return this.assignment.removeLimit(admin(req), id, code, dto.reason).then((data) => ({ data }));
  }
}
