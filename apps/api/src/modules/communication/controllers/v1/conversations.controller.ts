// modules/communication/controllers/v1/conversations.controller.ts · chat threads + messages.
// Membership-gated server-side (non-participant ⇒ 404, no IDOR). open + post require an Idempotency-Key (Law 3).
// `communication` flag. validate→authorize→delegate only.
import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ConversationService } from '../../services/conversation.service';
import { MessageService } from '../../services/message.service';
import { canModerateMessages } from '../../policies/communication.policies';
import { OpenConversationSchema, OpenConversationDto } from '../../dto/open-conversation.dto';
import { QueryConversationsSchema, QueryConversationsDto } from '../../dto/query-conversation.dto';
import { PostMessageSchema, PostMessageDto } from '../../dto/post-message.dto';
import { QueryMessagesSchema, QueryMessagesDto } from '../../dto/query-message.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'conversations', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('communication')
export class ConversationsController {
  constructor(private readonly convos: ConversationService, private readonly messages: MessageService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, isModerator: canModerateMessages(ctx) }; }

  @Post()
  open(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(OpenConversationSchema) dto: OpenConversationDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.convos.open(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryConversationsSchema) q: QueryConversationsDto) {
    return this.convos.list(ctx.tenantId, this.actor(ctx), { contextType: q.contextType, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.convos.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/read')
  read(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.convos.markRead(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/lock')
  lock(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Body('locked') locked?: boolean) { return this.convos.setLock(ctx.tenantId, this.actor(ctx), id, locked !== false).then((data) => ({ data })); }

  @Post(':id/messages')
  postMessage(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(PostMessageSchema) dto: PostMessageDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.messages.post(ctx.tenantId, this.actor(ctx), id, key, dto).then((data) => ({ data }));
  }
  @Get(':id/messages')
  listMessages(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodQuery(QueryMessagesSchema) q: QueryMessagesDto) {
    return this.messages.list(ctx.tenantId, this.actor(ctx), id, { cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Post('messages/:messageId/flag')
  flag(@CurrentContext() ctx: RequestContext, @Param('messageId') messageId: string) { return this.messages.flag(ctx.tenantId, this.actor(ctx), messageId).then((data) => ({ data })); }
}
