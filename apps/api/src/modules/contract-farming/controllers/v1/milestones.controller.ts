// modules/contract-farming/controllers/v1/milestones.controller.ts · record/complete/list contract milestones. `contract_farming` flag.
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { ContractMilestoneService } from '../../services/contract-milestone.service';
import { RecordMilestoneSchema, RecordMilestoneDto, CompleteMilestoneSchema, CompleteMilestoneDto } from '../../dto/create-contract-milestone.dto';
import { ContractFarmingPermissions, canManageContracts, isContractAdmin } from '../../policies/contract-farming.policies';

@Controller({ path: 'contract-farming', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('contract_farming')
export class MilestonesController {
  constructor(private readonly svc: ContractMilestoneService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageContracts(ctx), isAdmin: isContractAdmin(ctx) }; }

  @Post('contracts/:contractId/milestones') @RequirePermissions(ContractFarmingPermissions.Manage)
  record(@CurrentContext() ctx: RequestContext, @Param('contractId') contractId: string, @ZodBody(RecordMilestoneSchema) dto: RecordMilestoneDto) { return this.svc.record(ctx.tenantId, this.actor(ctx), contractId, dto).then((data) => ({ data })); }
  @Get('contracts/:contractId/milestones')
  list(@CurrentContext() ctx: RequestContext, @Param('contractId') contractId: string) { return this.svc.list(ctx.tenantId, this.actor(ctx), contractId).then((data) => ({ data })); }
  @Post('milestones/:id/complete') @RequirePermissions(ContractFarmingPermissions.Manage)
  complete(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(CompleteMilestoneSchema) dto: CompleteMilestoneDto) { return this.svc.complete(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
}
