// modules/communication/domain/broadcast.entity.ts · a tenant→audience announcement (PRD §14). PURE.
// Recorded on create as 'queued'; the BroadcastRequestedHandler moves it sending→sent as it fans out through the
// notification spine. The audience is the whole tenant (audienceRoleCode null) or a single role.
import { assertTransition, BroadcastStatus } from './broadcast.state';

export interface BroadcastProps {
  id: string; tenantId: string; createdByUserId: string; audienceRoleCode: string | null;
  title: string; body: string; status: BroadcastStatus; recipientCount: number; sentCount: number;
  failureReason: string | null; createdAt?: Date;
}

export class Broadcast {
  private constructor(private readonly props: BroadcastProps) {}

  static create(input: { id: string; tenantId: string; createdByUserId: string; audienceRoleCode: string | null; title: string; body: string }): Broadcast {
    return new Broadcast({ ...input, status: 'queued', recipientCount: 0, sentCount: 0, failureReason: null });
  }
  static rehydrate(props: BroadcastProps): Broadcast { return new Broadcast(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  toProps(): Readonly<BroadcastProps> { return Object.freeze({ ...this.props }); }

  markSending(): void { assertTransition(this.props.status, 'sending'); this.props.status = 'sending'; }
  markSent(recipientCount: number, sentCount: number): void {
    assertTransition(this.props.status, 'sent');
    this.props.status = 'sent'; this.props.recipientCount = recipientCount; this.props.sentCount = sentCount;
  }
  markFailed(reason: string): void { assertTransition(this.props.status, 'failed'); this.props.status = 'failed'; this.props.failureReason = reason; }

  toJSON() {
    const p = this.props;
    return { id: p.id, audienceRoleCode: p.audienceRoleCode, title: p.title, body: p.body, status: p.status,
      recipientCount: p.recipientCount, sentCount: p.sentCount, failureReason: p.failureReason, createdAt: p.createdAt };
  }
}
