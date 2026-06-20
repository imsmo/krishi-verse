// modules/communication/controllers/v1/notifications.controller.ts · the caller's OWN notification inbox.
// list + mark-read act on ctx.userId only (ownership is server-side; a non-owner read returns 404 — no IDOR).
// `communication` flag. validate→authorize→delegate only.
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { NotificationService } from '../../services/notification.service';
import { QueryNotificationsSchema, QueryNotificationsDto } from '../../dto/query-notification.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'notifications', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('communication')
export class NotificationsController {
  constructor(private readonly svc: NotificationService) {}

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryNotificationsSchema) q: QueryNotificationsDto) {
    return this.svc.listInbox(ctx.tenantId, ctx.userId, { status: q.status, unreadOnly: q.unreadOnly, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Post(':id/read')
  read(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.markRead(ctx.tenantId, ctx.userId, id).then((data) => ({ data })); }
}
