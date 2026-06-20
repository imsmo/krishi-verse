// modules/communication/controllers/v1/masked-calls.controller.ts · privacy-proxy calling + own call log.
// initiate requires an Idempotency-Key (it places a real telephony bridge — Law 3). Reads are the caller's own
// log (caller OR callee). `communication` flag.
import { Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { MaskedCallService } from '../../services/masked-call.service';
import { InitiateMaskedCallSchema, InitiateMaskedCallDto } from '../../dto/initiate-masked-call.dto';
import { QueryMaskedCallsSchema, QueryMaskedCallsDto } from '../../dto/query-masked-call.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'masked-calls', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('communication')
export class MaskedCallsController {
  constructor(private readonly svc: MaskedCallService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, isModerator: false }; }

  @Post()
  initiate(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(InitiateMaskedCallSchema) dto: InitiateMaskedCallDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.initiate(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryMaskedCallsSchema) q: QueryMaskedCallsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
}
