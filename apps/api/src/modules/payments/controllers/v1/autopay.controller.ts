// modules/payments/controllers/v1/autopay.controller.ts · the caller's OWN UPI autopay mandates
// (validate → authorize → delegate). Register/list/cancel are always the authenticated caller's own
// mandates (no userId param) → zero IDOR surface; the service additionally fails closed on a non-owner.
// Gated by the online_payments flag (autopay is an online-money feature). NO money moves on these routes.
import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { MandateService } from '../../services/mandate.service';
import { MandateExecutionService } from '../../services/mandate-execution.service';
import { SavedInstrumentsReadModel } from '../../read-models/saved-instruments.read-model';
import { RegisterMandateSchema, RegisterMandateDto, CancelMandateSchema, CancelMandateDto, ExecuteMandateSchema, ExecuteMandateDto } from '../../dto/create-mandate.dto';
import { canModeratePayment } from '../../policies/payments.policies';

const ipOf = (req: Request) => req.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'wallet/autopay', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('online_payments')
export class AutopayController {
  constructor(
    private readonly mandates: MandateService,
    private readonly execution: MandateExecutionService,
    private readonly instruments: SavedInstrumentsReadModel,
  ) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModeratePayment(ctx) }; }

  /** Register a pending UPI autopay mandate for the caller (Idempotency-Key scoped per user+endpoint). */
  @Post()
  register(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Headers('idempotency-key') key: string, @ZodBody(RegisterMandateSchema) dto: RegisterMandateDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.mandates.register(ctx.tenantId, ctx.userId, key, dto, ipOf(r)).then((data) => ({ data }));
  }

  /** The caller's own autopay mandates, keyset-paginated. */
  @Get()
  list(@CurrentContext() ctx: RequestContext, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.mandates.list(ctx.tenantId, ctx.userId, { cursor: decodeCursor(cursor), limit: lim }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.mandates.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data }));
  }

  /** Cancel (revoke) a mandate the caller owns. */
  @Delete(':id')
  cancel(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @Body() body: unknown) {
    const dto: CancelMandateDto = CancelMandateSchema.parse(body ?? {});
    return this.mandates.cancel(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data }));
  }

  /** Confirm (activate) a mandate after the user approved the standing instruction in their UPI app.
   *  Behind the `autopay_execution` flag (fail-closed in the service) — needs a live UPI-AutoPay PSP. */
  @Post(':id/confirm')
  confirm(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) {
    return this.execution.confirm(ctx.tenantId, this.actor(ctx), id, null, ipOf(r)).then((data) => ({ data }));
  }

  /** Present a capped debit against an active mandate → lands in the caller's wallet. Idempotency-Key required.
   *  Behind the `autopay_execution` flag (fail-closed in the service). */
  @Post(':id/execute')
  execute(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(ExecuteMandateSchema) dto: ExecuteMandateDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.execution.execute(ctx.tenantId, this.actor(ctx), id, { amountMinor: dto.amountMinor, idempotencyKey: key }, ipOf(r)).then((data) => ({ data }));
  }

  /** Recent collection attempts against a mandate the caller owns (audit list). */
  @Get(':id/executions')
  executions(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Query('limit') limit?: string) {
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.execution.listExecutions(ctx.tenantId, this.actor(ctx), id, lim).then((data) => ({ data }));
  }
}
