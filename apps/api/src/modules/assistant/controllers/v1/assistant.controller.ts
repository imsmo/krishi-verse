// modules/assistant/controllers/v1/assistant.controller.ts · the governed farmer assistant turn.
// POST ai/assistant/messages — authenticated (any tenant user; no special perm — it's a farmer-facing helper),
// behind the `ai_assistant` flag, idempotent (Law 3). validate→authorize→delegate only. The service owns the
// guardrails + cost/rate caps + governed inference + ai_inferences logging; the model is the only place an answer
// is generated, and a blocked/degraded turn returns a SAFE non-fabricated reply.
import { Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { AssistantService } from '../../services/assistant.service';
import { AskAssistantSchema, AskAssistantDto } from '../../dto/assistant.dto';

@Controller({ path: 'ai/assistant', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('ai_assistant')
export class AssistantController {
  constructor(private readonly svc: AssistantService) {}

  @Post('messages')
  ask(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(AskAssistantSchema) dto: AskAssistantDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.ask(ctx.tenantId, { userId: ctx.userId }, key, dto).then((data) => ({ data }));
  }
}
