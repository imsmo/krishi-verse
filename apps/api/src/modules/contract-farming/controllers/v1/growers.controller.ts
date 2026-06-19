// modules/contract-farming/controllers/v1/growers.controller.ts · enrol/list growers on a contract. `contract_farming` flag.
import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ContractGrowerService } from '../../services/contract-grower.service';
import { EnrolGrowerSchema, EnrolGrowerDto } from '../../dto/create-contract-grower.dto';
import { ContractFarmingPermissions, canManageContracts, isContractAdmin } from '../../policies/contract-farming.policies';

@Controller({ path: 'contract-farming/contracts/:contractId/growers', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('contract_farming')
export class GrowersController {
  constructor(private readonly svc: ContractGrowerService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageContracts(ctx), isAdmin: isContractAdmin(ctx) }; }

  @Post() @RequirePermissions(ContractFarmingPermissions.Manage)
  enrol(@CurrentContext() ctx: RequestContext, @Param('contractId') contractId: string, @Headers('idempotency-key') key: string, @ZodBody(EnrolGrowerSchema) dto: EnrolGrowerDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.enrol(ctx.tenantId, this.actor(ctx), contractId, key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @Param('contractId') contractId: string) { return this.svc.list(ctx.tenantId, this.actor(ctx), contractId).then((data) => ({ data })); }
}
