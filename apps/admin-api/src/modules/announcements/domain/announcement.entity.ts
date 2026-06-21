// apps/admin-api/src/modules/announcements/domain/announcement.entity.ts · the platform-announcement aggregate
// (pure, no I/O). Lifecycle goes ONLY through the state machine (Law 5): draft → scheduled/published → expired →
// archived. Content/schedule are editable only while draft/scheduled (a published notice is immutable — archive +
// recreate). Text is plain (no HTML — validated by the caller via assertPlainText). No money, no PII.
import { AnnouncementStatus, assertTransition, isEditable } from './announcement.state';
import { Severity, Placement, Audience } from './content';
import { AnnouncementImmutableError, InvalidScheduleError } from './announcements.errors';

export interface AnnouncementProps {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  placement: Placement;
  status: AnnouncementStatus;
  audience: Audience;
  startsAt: Date | null;
  endsAt: Date | null;
  publishedAt: Date | null;
  createdAt?: Date | null;
}
export interface AnnouncementChange { action: 'created' | 'updated' | 'scheduled' | 'published' | 'expired' | 'archived'; oldValue: Record<string, unknown>; newValue: Record<string, unknown>; }

export class Announcement {
  private constructor(private p: AnnouncementProps) {}
  static rehydrate(p: AnnouncementProps): Announcement { return new Announcement(p); }

  get id(): string { return this.p.id; }
  get status(): AnnouncementStatus { return this.p.status; }

  private assertEditable(): void { if (!isEditable(this.p.status)) throw new AnnouncementImmutableError(this.p.status); }

  /** Edit content (draft/scheduled only). Validated text/audience are passed in by the service. */
  updateContent(fields: { title: string; body: string; severity: Severity; placement: Placement; audience: Audience }): AnnouncementChange {
    this.assertEditable();
    const old = { title: this.p.title, severity: this.p.severity, placement: this.p.placement };
    this.p.title = fields.title; this.p.body = fields.body; this.p.severity = fields.severity; this.p.placement = fields.placement; this.p.audience = fields.audience;
    return { action: 'updated', oldValue: old, newValue: { title: fields.title, severity: fields.severity, placement: fields.placement } };
  }

  /** Set the schedule window and move draft → scheduled (window pre-validated by the caller). */
  schedule(startsAt: Date, endsAt: Date): AnnouncementChange {
    const from = this.p.status;
    assertTransition(from, 'scheduled');
    this.p.startsAt = startsAt; this.p.endsAt = endsAt; this.p.status = 'scheduled';
    return { action: 'scheduled', oldValue: { status: from }, newValue: { status: 'scheduled', startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } };
  }

  /** Go live now (draft|scheduled → published). Pass endsAt to publish-now an unscheduled draft; otherwise the
   *  existing scheduled window is used. startsAt defaults to now. endsAt must exist and be in the future. */
  publish(endsAt: Date | null, now = new Date()): AnnouncementChange {
    const from = this.p.status;
    assertTransition(from, 'published');
    if (endsAt) this.p.endsAt = endsAt;
    if (!this.p.endsAt) throw new InvalidScheduleError('set an end date before publishing (schedule it, or pass endsAt)');
    if (this.p.endsAt.getTime() <= now.getTime()) throw new InvalidScheduleError('endsAt must be in the future');
    if (!this.p.startsAt) this.p.startsAt = now;
    this.p.status = 'published'; this.p.publishedAt = now;
    return { action: 'published', oldValue: { status: from }, newValue: { status: 'published', publishedAt: now.toISOString() } };
  }

  expire(): AnnouncementChange {
    const from = this.p.status;
    assertTransition(from, 'expired');
    this.p.status = 'expired';
    return { action: 'expired', oldValue: { status: from }, newValue: { status: 'expired' } };
  }
  archive(): AnnouncementChange {
    const from = this.p.status;
    assertTransition(from, 'archived');
    this.p.status = 'archived';
    return { action: 'archived', oldValue: { status: from }, newValue: { status: 'archived' } };
  }

  snapshot() { return { title: this.p.title, body: this.p.body, severity: this.p.severity, placement: this.p.placement, audience: this.p.audience, startsAt: this.p.startsAt, endsAt: this.p.endsAt, publishedAt: this.p.publishedAt, status: this.p.status }; }
  toJSON() {
    return { id: this.p.id, title: this.p.title, body: this.p.body, severity: this.p.severity, placement: this.p.placement, status: this.p.status,
      audience: this.p.audience, startsAt: this.p.startsAt, endsAt: this.p.endsAt, publishedAt: this.p.publishedAt, createdAt: this.p.createdAt ?? null };
  }
}
