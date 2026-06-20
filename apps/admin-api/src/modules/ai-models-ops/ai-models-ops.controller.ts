// apps/admin-api/src/modules/ai-models-ops/ai-models-ops.controller.ts · god-mode model registry surface.
// Every route: AdminAuthGuard (verified admin JWT) + OwnerPermissionsGuard. MUTATIONS additionally require
// HardwareKeyGuard (FIDO2) + StepUpReauthGuard (recent re-auth) — JIT elevation for consequential changes.
// validate (zod) → authorize (owner perm) → delegate. No business logic here.
import { Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { ModelRegistryService } from './services/model-registry.service';
import { ThresholdTuningService } from './services/threshold-tuning.service';
import { FairnessAuditReportsService } from './services/fairness-audit-reports.service';
import { RegisterModelSchema, RegisterModelDto, PromoteModelSchema, PromoteModelDto, TuneThresholdSchema, TuneThresholdDto, QueryModelsSchema, QueryModelsDto } from './dto/ai-models-ops.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'ai/models', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class AiModelsOpsController {
  constructor(
    private readonly registry: ModelRegistryService,
    private readonly tuning: ThresholdTuningService,
    private readonly fairness: FairnessAuditReportsService,
  ) {}

  @Get() @RequireOwnerPermission(OwnerPermissions.AiModelRead)
  list(@ZodQuery(QueryModelsSchema) q: QueryModelsDto) {
    return this.registry.list({ code: q.code, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id') @RequireOwnerPermission(OwnerPermissions.AiModelRead)
  get(@Param('id') id: string) { return this.registry.getById(id).then((data) => ({ data })); }

  @Get(':id/fairness') @RequireOwnerPermission(OwnerPermissions.AiModelRead)
  fairnessReport(@Req() req: any, @Param('id') id: string) { return this.fairness.report(admin(req), id).then((data) => ({ data })); }

  // ---- mutations: hardware-key + step-up elevation required ----
  @Post() @RequireOwnerPermission(OwnerPermissions.AiModelManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  register(@Req() req: any, @ZodBody(RegisterModelSchema) dto: RegisterModelDto) {
    return this.registry.register(admin(req), dto).then((data) => ({ data }));
  }
  @Post(':id/promote') @RequireOwnerPermission(OwnerPermissions.AiModelManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  promote(@Req() req: any, @Param('id') id: string, @ZodBody(PromoteModelSchema) dto: PromoteModelDto) {
    return this.registry.promote(admin(req), id, dto).then((data) => ({ data }));
  }
  @Patch(':id/threshold') @RequireOwnerPermission(OwnerPermissions.AiModelManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  tune(@Req() req: any, @Param('id') id: string, @ZodBody(TuneThresholdSchema) dto: TuneThresholdDto) {
    return this.tuning.tune(admin(req), id, dto).then((data) => ({ data }));
  }
}
