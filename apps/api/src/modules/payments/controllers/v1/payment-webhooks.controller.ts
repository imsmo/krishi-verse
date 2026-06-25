// modules/payments/controllers/v1/payment-webhooks.controller.ts
// PUBLIC, UNAUTHENTICATED gateway webhook sink — there is no JWT here. Trust is established ONLY
// by the HMAC signature over the raw body (verified in the gateway adapter); the tenant is read
// from the signature-verified order notes. The raw bytes come from req.rawBody (main.ts sets
// rawBody:true) so the signature matches exactly. Processing is idempotent on the gateway event id.
import { Controller, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { PaymentService } from '../../services/payment.service';
import { RazorpayPayoutWebhookHandler } from '../../events/handlers/razorpay-webhook.handler';

// Razorpay sends 'x-razorpay-signature'; the sandbox uses 'x-webhook-signature'. Accept either.
function signatureOf(req: Request): string {
  const h = req.headers;
  return (h['x-razorpay-signature'] as string) || (h['x-webhook-signature'] as string) || '';
}
// Razorpay's canonical per-delivery event id — the most robust webhook dedup key (empty for the sandbox).
function eventIdOf(req: Request): string {
  return (req.headers['x-razorpay-event-id'] as string) || '';
}

@Controller({ path: 'payments/webhooks', version: '1' })
export class PaymentWebhooksController {
  constructor(
    private readonly payments: PaymentService,
    private readonly payoutWebhook: RazorpayPayoutWebhookHandler,
  ) {}

  @Post(':provider')
  @HttpCode(200) // always 200 on accepted/ignored so the gateway doesn't infinitely retry; errors throw.
  handle(@Param('provider') provider: string, @Req() req: Request & { rawBody?: Buffer }) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {});
    if (!raw) throw new BadRequestError('empty webhook body');
    return this.payments.handleWebhook(provider, raw, signatureOf(req), eventIdOf(req)).then((data) => ({ data }));
  }

  /** Async PAYOUT callback (RazorpayX payout.processed/failed/reversed). Same trust model: HMAC over
   *  the raw body, tenant from signed notes. Idempotent on the gateway event id. */
  @Post(':provider/payouts')
  @HttpCode(200)
  handlePayout(@Param('provider') _provider: string, @Req() req: Request & { rawBody?: Buffer }) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {});
    if (!raw) throw new BadRequestError('empty webhook body');
    return this.payoutWebhook.ingest(raw, signatureOf(req)).then((data) => ({ data }));
  }
}
