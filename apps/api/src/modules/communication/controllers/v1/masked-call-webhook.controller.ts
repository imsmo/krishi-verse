// modules/communication/controllers/v1/masked-call-webhook.controller.ts · PUBLIC, UNAUTHENTICATED call-status
// sink: the masking telephony provider POSTs here when a call ends. Trust is established ONLY by the HMAC-SHA256
// signature over the RAW body (constant-time compare against MASKING_WEBHOOK_SECRET) — fail-closed if
// unconfigured/mismatched. Idempotent (provider_call_ref → duration). No raw phone numbers are accepted/stored.
import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../../../core/config/app-config';
import { BadRequestError, ForbiddenError } from '../../../../shared/errors/app-error';
import { MaskedCallService } from '../../services/masked-call.service';

@Controller({ path: 'masked-calls/status-callback', version: '1' })
export class MaskedCallWebhookController {
  constructor(private readonly svc: MaskedCallService, private readonly config: AppConfig) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-masking-signature') signature: string) {
    const secret = this.config.masking.webhookSecret;
    if (!secret) throw new ForbiddenError('masking webhook not configured');   // fail-closed
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {});
    if (!raw) throw new BadRequestError('empty call-status body');
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(expected); const b = Buffer.from(signature || '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenError('bad signature');
    const body = (req.body ?? {}) as { tenantId?: string | null; providerCallRef?: string; durationSecs?: number; recordingMediaId?: string | null };
    if (!body.providerCallRef || typeof body.durationSecs !== 'number') throw new BadRequestError('providerCallRef + durationSecs required');
    const applied = await this.svc.applyCallStatus(body.tenantId ?? null, body.providerCallRef, body.durationSecs, body.recordingMediaId ?? null);
    return { data: { applied } };
  }
}
