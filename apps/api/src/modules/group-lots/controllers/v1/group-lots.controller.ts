// modules/group-lots/controllers/v1/group-lots.controller.ts · FPO group-lot coordination. create/pledge/ready/
// cancel/settle need group_lot.coordinate; browse + detail are any authenticated tenant user. create/pledge carry
// an Idempotency-Key (Law 3). Gated by the `group_lots` feature flag.
import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { GroupLotService } from '../../services/group-lot.service';
import { CreateGroupLotSchema, CreateGroupLotDto, PledgeSchema, PledgeDto, SettleSchema, SettleDto } from '../../dto/group-lot.dto';
import { QueryGroupLotsSchema, QueryGroupLotsDto } from '../../dto/group-lot.dto';
import { GroupLotPermissions, canCoordinate } from '../../policies/group-lot.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'group-lots', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('group_lots')
export class GroupLotsController {
  constructor(private readonly svc: GroupLotService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canCoordinate: canCoordinate(ctx) }; }

  @Post() @RequirePermissions(GroupLotPermissions.Coordinate)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateGroupLotSchema) dto: CreateGroupLotDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryGroupLotsSchema) q: QueryGroupLotsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Post(':id/pledges') @RequirePermissions(GroupLotPermissions.Coordinate)
  pledge(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(PledgeSchema) dto: PledgeDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.pledge(ctx.tenantId, this.actor(ctx), key, id, dto).then((data) => ({ data }));
  }
  @Post(':id/ready') @RequirePermissions(GroupLotPermissions.Coordinate)
  ready(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.markReady(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/cancel') @RequirePermissions(GroupLotPermissions.Coordinate)
  cancel(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.cancel(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/settle') @RequirePermissions(GroupLotPermissions.Coordinate)
  settle(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(SettleSchema) dto: SettleDto) { return this.svc.settle(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
}
