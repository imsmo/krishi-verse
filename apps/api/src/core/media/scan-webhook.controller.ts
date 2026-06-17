// core/media/scan-webhook.controller.ts
// PUBLIC, UNAUTHENTICATED antivirus scan-result sink (the AV/S3 scanner POSTs here after scanning an
// uploaded object). Trust is established ONLY by the HMAC signature over the raw body (verified in
// MediaService); the tenant + media id are read from the signature-verified s3 key. Idempotent.
import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BadRequestError } from '../../shared/errors/app-error';
import { MediaService } from './media-links.service';

@Controller({ path: 'media/scan-callback', version: '1' })
export class ScanWebhookController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @HttpCode(200)
  handle(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-scan-signature') signature: string) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {});
    if (!raw) throw new BadRequestError('empty scan body');
    return this.media.handleScanResult(raw, signature || '').then((data) => ({ data }));
  }
}
