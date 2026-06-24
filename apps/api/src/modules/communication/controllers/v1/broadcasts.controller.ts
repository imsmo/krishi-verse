// modules/communication/controllers/v1/broadcasts.controller.ts · tenant→audience broadcast send + history.
// Sending needs notification.manage (a tenant admin/ops). The send is idempotent (Idempotency-Key) and queues an
// async fan-out; the list is the tenant's own broadcast history (keyset). Gated by the `communication` flag.
import { Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { CommPermissions, canManageComms } from '../../policies/communication.policies';
import { BroadcastService } from '../../services/broadcast.service';
import { CreateBroadcastSchema, CreateBroadcastDto, QueryBroadcastsSchema, QueryBroadcastsDto } from '../../dto/create-broadcast.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'communication/broadcasts', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('communication')
export class BroadcastsController {
  constructor(private readonly svc: BroadcastService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageComms(ctx) }; }

  @Post() @RequirePermissions(CommPermissions.Manage)
  send(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateBroadcastSchema) dto: CreateBroadcastDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }

  @Get() @RequirePermissions(CommPermissions.Manage)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryBroadcastsSchema) q: QueryBroadcastsDto) {
    return this.svc.list(ctx.tenantId, { cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
}
