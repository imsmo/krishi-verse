// modules/education/domain/live-session.entity.ts · a streaming session hosted by an approved-channel owner.
// Lifecycle scheduled→live→ended (+cancel from scheduled) via live-session.state (Law 5). The streaming
// provider's stream ref + playback URL are attached at start; a recording media id may be set after end.
import { DomainEvent, CreatorEventType, LiveStatus } from './creator.events';
import { assertTransition } from './live-session.state';
import { InvalidLiveSessionError } from './creator.errors';

export interface LiveSessionProps {
  id: string; tenantId: string; hostUserId: string; channelId: string | null; title: string; topicId: string | null;
  scheduledAt: Date; status: LiveStatus; providerStreamRef: string | null; playbackUrl: string | null;
  recordingMediaId: string | null; startedAt: Date | null; endedAt: Date | null; createdAt?: Date;
}
export class LiveSession {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: LiveSessionProps) {}

  static schedule(input: Omit<LiveSessionProps, 'status' | 'providerStreamRef' | 'playbackUrl' | 'recordingMediaId' | 'startedAt' | 'endedAt'>): LiveSession {
    if (!input.title) throw new InvalidLiveSessionError('title required');
    const s = new LiveSession({ ...input, status: 'scheduled', providerStreamRef: null, playbackUrl: null, recordingMediaId: null, startedAt: null, endedAt: null });
    s.events.push({ type: CreatorEventType.LiveScheduled, payload: { sessionId: s.props.id, hostUserId: s.props.hostUserId, scheduledAt: s.props.scheduledAt.toISOString() } });
    return s;
  }
  static rehydrate(p: LiveSessionProps): LiveSession { return new LiveSession(p); }
  get id() { return this.props.id; }
  get hostUserId() { return this.props.hostUserId; }
  get status() { return this.props.status; }
  toProps(): Readonly<LiveSessionProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  start(providerStreamRef: string, playbackUrl: string | null): void {
    assertTransition(this.props.status, 'live');
    this.props.status = 'live'; this.props.providerStreamRef = providerStreamRef; this.props.playbackUrl = playbackUrl; this.props.startedAt = new Date();
    this.events.push({ type: CreatorEventType.LiveStarted, payload: { sessionId: this.props.id, hostUserId: this.props.hostUserId } });
  }
  end(recordingMediaId: string | null): void {
    assertTransition(this.props.status, 'ended');
    this.props.status = 'ended'; this.props.endedAt = new Date(); if (recordingMediaId) this.props.recordingMediaId = recordingMediaId;
    this.events.push({ type: CreatorEventType.LiveEnded, payload: { sessionId: this.props.id } });
  }
  cancel(): void {
    assertTransition(this.props.status, 'cancelled');
    this.props.status = 'cancelled';
    this.events.push({ type: CreatorEventType.LiveCancelled, payload: { sessionId: this.props.id } });
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, hostUserId: v.hostUserId, channelId: v.channelId, title: v.title, topicId: v.topicId, scheduledAt: v.scheduledAt,
      status: v.status, playbackUrl: v.playbackUrl, recordingMediaId: v.recordingMediaId, startedAt: v.startedAt, endedAt: v.endedAt, createdAt: v.createdAt };
  }
}
