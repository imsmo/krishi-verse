// modules/exports/controllers/v1/shipments.controller.ts · export shipment lifecycle. `exports` flag.
import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ExportShipmentService } from '../../services/export-shipment.service';
import { CreateShipmentSchema, CreateShipmentDto, AdvanceShipmentSchema, AdvanceShipmentDto } from '../../dto/create-export-shipment.dto';
import { QueryShipmentsSchema, QueryShipmentsDto } from '../../dto/query-export-shipment.dto';
import { ExportsPermissions, canManageExports, isExportsAdmin } from '../../policies/exports.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'exports/shipments', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('exports')
export class ShipmentsController {
  constructor(private readonly svc: ExportShipmentService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageExports(ctx), isAdmin: isExportsAdmin(ctx) }; }

  @Post() @RequirePermissions(ExportsPermissions.Manage)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateShipmentSchema) dto: CreateShipmentDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryShipmentsSchema) q: QueryShipmentsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/advance') @RequirePermissions(ExportsPermissions.Manage)
  advance(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(AdvanceShipmentSchema) dto: AdvanceShipmentDto) {
    return this.svc.advance(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data }));
  }
}
