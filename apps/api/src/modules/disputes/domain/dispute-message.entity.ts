// modules/disputes/domain/dispute-message.entity.ts · a threaded evidence/communication line on a
// dispute (append-only). Pure domain: validates the body. Authored by a party or a moderator.
import { InvalidDisputeError } from './disputes.errors';

export interface DisputeMessageProps { id: string; disputeId: string; tenantId: string; authorUserId: string; body: string; createdAt: Date; }
const MAX_BODY = 4000;

export class DisputeMessage {
  private constructor(readonly props: DisputeMessageProps) {}
  static create(input: { id: string; disputeId: string; tenantId: string; authorUserId: string; body: string; now?: Date }): DisputeMessage {
    const body = (input.body ?? '').trim();
    if (!body) throw new InvalidDisputeError('message body is required');
    if (body.length > MAX_BODY) throw new InvalidDisputeError(`message exceeds ${MAX_BODY} chars`);
    return new DisputeMessage({ id: input.id, disputeId: input.disputeId, tenantId: input.tenantId, authorUserId: input.authorUserId, body, createdAt: input.now ?? new Date() });
  }
}
