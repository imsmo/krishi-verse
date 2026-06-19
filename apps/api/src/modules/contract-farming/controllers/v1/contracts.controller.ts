// modules/contract-farming/controllers/v1/contracts.controller.ts · contract lifecycle + templates + advances + settlement.
// All writes need contract.manage (buyer/admin). Money routes (advance, settle) require an Idempotency-Key (Law 3). `contract_farming` flag.
import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { FarmingContractService } from '../../services/farming-contract.service';
import { ContractTemplateService } from '../../services/contract-template.service';
import { InputAdvanceService } from '../../services/input-advance.service';
import { CreateContractSchema, CreateContractDto, SettleGrowerSchema, SettleGrowerDto } from '../../dto/create-farming-contract.dto';
import { QueryContractsSchema, QueryContractsDto } from '../../dto/query-farming-contract.dto';
import { CreateTemplateSchema, CreateTemplateDto } from '../../dto/create-contract-template.dto';
import { QueryTemplatesSchema, QueryTemplatesDto } from '../../dto/query-contract-template.dto';
import { DisburseAdvanceSchema, DisburseAdvanceDto } from '../../dto/create-input-advance.dto';
import { QueryAdvancesSchema, QueryAdvancesDto } from '../../dto/query-input-advance.dto';
import { ContractFarmingPermissions, canManageContracts, isContractAdmin } from '../../policies/contract-farming.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'contract-farming/contracts', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('contract_farming')
export class ContractsController {
  constructor(private readonly svc: FarmingContractService, private readonly templates: ContractTemplateService, private readonly advances: InputAdvanceService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageContracts(ctx), isAdmin: isContractAdmin(ctx) }; }

  // templates
  @Post('templates') @RequirePermissions(ContractFarmingPermissions.Manage)
  createTemplate(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateTemplateSchema) dto: CreateTemplateDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.templates.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get('templates')
  listTemplates(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryTemplatesSchema) q: QueryTemplatesDto) { return this.templates.list(ctx.tenantId, q.activeOnly).then((data) => ({ data })); }
  @Get('templates/:id')
  getTemplate(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.templates.getById(ctx.tenantId, id).then((data) => ({ data })); }

  // contracts
  @Post() @RequirePermissions(ContractFarmingPermissions.Manage)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateContractSchema) dto: CreateContractDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryContractsSchema) q: QueryContractsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/propose') @RequirePermissions(ContractFarmingPermissions.Manage)
  propose(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.propose(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/sign') @RequirePermissions(ContractFarmingPermissions.Manage)
  sign(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.sign(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/activate') @RequirePermissions(ContractFarmingPermissions.Manage)
  activate(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.activate(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/fulfill') @RequirePermissions(ContractFarmingPermissions.Manage)
  fulfill(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.fulfill(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/terminate') @RequirePermissions(ContractFarmingPermissions.Manage)
  terminate(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Body('reason') reason?: string) { return this.svc.terminate(ctx.tenantId, this.actor(ctx), id, reason).then((data) => ({ data })); }

  // input advances (money)
  @Post(':id/advances') @RequirePermissions(ContractFarmingPermissions.Manage)
  disburse(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(DisburseAdvanceSchema) dto: DisburseAdvanceDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.advances.disburse(ctx.tenantId, this.actor(ctx), id, key, dto, ipOf(r)).then((data) => ({ data }));
  }
  @Get(':id/advances')
  listAdvances(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodQuery(QueryAdvancesSchema) q: QueryAdvancesDto) { return this.advances.list(ctx.tenantId, this.actor(ctx), id, q.growerId).then((data) => ({ data })); }

  // settlement (money)
  @Post(':id/settle') @RequirePermissions(ContractFarmingPermissions.Manage)
  settle(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(SettleGrowerSchema) dto: SettleGrowerDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.settleGrower(ctx.tenantId, this.actor(ctx), id, key, dto, ipOf(r)).then((data) => ({ data }));
  }
}
