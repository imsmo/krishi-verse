// apps/web-admin/src/test/announcement.spec.ts · unit tests for the pure announcement helpers: lifecycle gating
// (mirror admin-api), plain-text + audience content validation, and the schedule/publish builders.
import {
  ANNOUNCEMENT_STATUSES, announcementStatusKey, isTerminal, canEdit, canSchedule, canPublish, canExpire, canArchive,
  parseCsvList, isPlainText, buildContent, buildSchedule, buildPublish, buildReason,
} from '../features/announcements/announcement';

describe('announcement lifecycle (mirrors admin-api)', () => {
  it('action gating', () => {
    expect(canEdit('draft')).toBe(true);
    expect(canEdit('scheduled')).toBe(true);
    expect(canEdit('published')).toBe(false);
    expect(canSchedule('draft')).toBe(true);
    expect(canSchedule('scheduled')).toBe(false);
    expect(canPublish('draft')).toBe(true);
    expect(canPublish('scheduled')).toBe(true);
    expect(canExpire('published')).toBe(true);
    expect(canExpire('draft')).toBe(false);
    expect(canArchive('expired')).toBe(true);
    expect(canArchive('archived')).toBe(false);
    expect(isTerminal('archived')).toBe(true);
    expect(announcementStatusKey('weird')).toBe('draft');
    expect(ANNOUNCEMENT_STATUSES).toContain('published');
  });
});

describe('parseCsvList + isPlainText', () => {
  it('splits + de-dupes', () => {
    expect(parseCsvList('pro_in, pro_in, free')).toEqual(['pro_in', 'free']);
    expect(parseCsvList('')).toEqual([]);
  });
  it('rejects HTML', () => {
    expect(isPlainText('hello world')).toBe(true);
    expect(isPlainText('<script>')).toBe(false);
  });
});

describe('buildContent (plain-text, audience-bounded)', () => {
  it('assembles + upper-cases countries', () => {
    const r = buildContent({ title: 'Maintenance', body: 'Scheduled downtime tonight', severity: 'warning', placement: 'banner', plans: 'pro_in,free', countries: 'in,us', reason: 'planned maint' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ severity: 'warning', plans: ['pro_in', 'free'], countries: ['IN', 'US'] });
  });
  it('defaults severity/placement', () => {
    const r = buildContent({ title: 'Hi', body: 'Body text', reason: 'a reason' });
    expect(r.ok && r.value.severity).toBe('info');
    expect(r.ok && r.value.placement).toBe('banner');
  });
  it('rejects HTML title / bad plan / short reason', () => {
    expect(buildContent({ title: '<b>x</b>', body: 'ok body', reason: 'a reason' })).toEqual({ ok: false, error: 'title' });
    expect(buildContent({ title: 'ok', body: 'ok body', plans: 'BAD CODE', reason: 'a reason' })).toEqual({ ok: false, error: 'plans' });
    expect(buildContent({ title: 'ok', body: 'ok body', reason: 'no' })).toEqual({ ok: false, error: 'reason' });
  });
});

describe('buildSchedule / buildPublish', () => {
  it('schedule needs a forward ISO window', () => {
    expect(buildSchedule({ startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-10T00:00:00Z', reason: 'window' }).ok).toBe(true);
    expect(buildSchedule({ startsAt: '2026-06-10T00:00:00Z', endsAt: '2026-06-01T00:00:00Z', reason: 'window' })).toEqual({ ok: false, error: 'window' });
    expect(buildSchedule({ startsAt: 'nope', endsAt: '2026-06-10T00:00:00Z', reason: 'window' })).toEqual({ ok: false, error: 'startsAt' });
  });
  it('publish endsAt optional but must be ISO when present', () => {
    expect(buildPublish({ reason: 'go live' }).ok).toBe(true);
    expect(buildPublish({ endsAt: '2026-06-10T00:00:00Z', reason: 'go live' }).ok).toBe(true);
    expect(buildPublish({ endsAt: 'nope', reason: 'go live' })).toEqual({ ok: false, error: 'endsAt' });
  });
  it('buildReason', () => {
    expect(buildReason({ reason: 'expire it' }).ok).toBe(true);
    expect(buildReason({ reason: 'no' })).toEqual({ ok: false, error: 'reason' });
  });
});
