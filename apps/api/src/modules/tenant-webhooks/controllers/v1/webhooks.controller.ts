// modules/tenant-webhooks/controllers/v1/webhooks.controller.ts · the calling tenant's webhook endpoints
// (validate→authorize→delegate). All scoped to ctx.tenantId (Law 1). Mutations need tenant.settings (the tenant's
// own admin — NOT god-mode, Law 11). The signing secret is returned ONLY by register + rotate (shown once). Gated by
// the `tenancy` feature flag.
import { Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { TenancyPermissions, tenantActorOf } from '../../../tenancy/policies/tenancy.policies';
import { TenantWebhookService } from '../../services/tenant-webhook.service';
import { CreateWebhookSchema, CreateWebhookDto, UpdateWebhookSchema, UpdateWebhookDto } from '../../dto/create-webhook.dto';
import { WEBHOOK_EVENT_TYPES } from '../../domain/webhook-events';

const ipOf = (r: Request) => (r.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || r.ip || null;

@Controller({ path: 'webhooks', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('tenancy')
export class WebhooksController {
  constructor(private readonly webhooks: TenantWebhookService) {}

  /** The event types an endpoint may subscribe to (allow-list). */
  @Get('events')
  events() { return { data: WEBHOOK_EVENT_TYPES }; }

  @Get()
  list(@CurrentContext() ctx: RequestContext) { return this.webhooks.list(ctx.tenantId).then((data) => ({ data })); }

  @Post() @RequirePermissions(TenancyPermissions.ManageTenant)
  register(@CurrentContext() ctx: RequestContext, @Req() r: Request, @ZodBody(CreateWebhookSchema) dto: CreateWebhookDto) {
    return this.webhooks.register(ctx.tenantId, tenantActorOf(ctx), dto, ipOf(r)).then((data) => ({ data }));
  }

  @Patch(':id') @RequirePermissions(TenancyPermissions.ManageTenant)
  update(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(UpdateWebhookSchema) dto: UpdateWebhookDto) {
    return this.webhooks.update(ctx.tenantId, tenantActorOf(ctx), id, dto, ipOf(r)).then((data) => ({ data }));
  }

  @Post(':id/rotate-secret') @RequirePermissions(TenancyPermissions.ManageTenant)
  rotate(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) {
    return this.webhooks.rotateSecret(ctx.tenantId, tenantActorOf(ctx), id, ipOf(r)).then((data) => ({ data }));
  }

  @Delete(':id') @RequirePermissions(TenancyPermissions.ManageTenant)
  remove(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) {
    return this.webhooks.remove(ctx.tenantId, tenantActorOf(ctx), id, ipOf(r)).then((data) => ({ data }));
  }
}
