// modules/communication/controllers/v1/delivery-webhook.controller.ts · PUBLIC, UNAUTHENTICATED delivery-status
// sink: the external notifier POSTs here when a message is delivered/failed. Trust is established ONLY by the
// HMAC-SHA256 signature over the RAW body (constant-time compare against NOTIFY_WEBHOOK_SECRET) — fail-closed
// if unconfigured or mismatched. Idempotent (provider_msg_ref → delivered). `communication` flag.
import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../../../core/config/app-config';
import { BadRequestError, ForbiddenError } from '../../../../shared/errors/app-error';
import { NotificationService } from '../../services/notification.service';

@Controller({ path: 'notifications/delivery-callback', version: '1' })
export class DeliveryWebhookController {
  constructor(private readonly svc: NotificationService, private readonly config: AppConfig) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-notify-signature') signature: string) {
    const secret = this.config.notifications.webhookSecret;
    if (!secret) throw new ForbiddenError('delivery webhook not configured');   // fail-closed
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {});
    if (!raw) throw new BadRequestError('empty delivery body');
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(expected); const b = Buffer.from(signature || '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenError('bad signature');
    const body = (req.body ?? {}) as { tenantId?: string | null; providerMsgRef?: string; status?: string };
    if (!body.providerMsgRef || (body.status !== 'delivered' && body.status !== 'failed')) throw new BadRequestError('providerMsgRef + status(delivered|failed) required');
    const applied = await this.svc.applyDeliveryStatus(body.tenantId ?? null, body.providerMsgRef, body.status);
    return { data: { applied } };
  }
}
