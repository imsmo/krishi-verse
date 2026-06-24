// modules/communication/__tests__/broadcast-state.spec.ts · pure broadcast state machine + entity (API-W10).
import { canTransition, assertTransition, BROADCAST_STATUSES, BroadcastStatus, IllegalBroadcastTransitionError } from '../domain/broadcast.state';
import { Broadcast } from '../domain/broadcast.entity';

describe('broadcast.state machine', () => {
  it('queued → sending → sent; queued/sending → failed', () => {
    expect(canTransition('queued', 'sending')).toBe(true);
    expect(canTransition('sending', 'sent')).toBe(true);
    expect(canTransition('queued', 'failed')).toBe(true);
    expect(canTransition('sending', 'failed')).toBe(true);
  });
  it('forbids skipping queued→sent and any move out of a terminal', () => {
    expect(canTransition('queued', 'sent')).toBe(false);
    expect(canTransition('sent', 'sending')).toBe(false);
    expect(canTransition('failed', 'sending')).toBe(false);
  });
  it('covers every status without throwing', () => { for (const s of BROADCAST_STATUSES) expect(() => canTransition(s, 'failed' as BroadcastStatus)).not.toThrow(); });
  it('assertTransition throws a typed 409 on an illegal move', () => {
    expect(() => assertTransition('sent', 'queued')).toThrow(IllegalBroadcastTransitionError);
    expect(new IllegalBroadcastTransitionError('sent', 'queued').code).toBe('BROADCAST_ILLEGAL_TRANSITION');
  });
});

describe('Broadcast entity', () => {
  const make = () => Broadcast.create({ id: 'b1', tenantId: 't1', createdByUserId: 'u1', audienceRoleCode: null, title: 'Hi', body: 'Body' });
  it('starts queued with zero counts', () => {
    const b = make(); expect(b.status).toBe('queued');
    expect(b.toProps().recipientCount).toBe(0); expect(b.toProps().sentCount).toBe(0);
  });
  it('queued → sending → sent records counts', () => {
    const b = make(); b.markSending(); expect(b.status).toBe('sending');
    b.markSent(120, 118); expect(b.status).toBe('sent');
    expect(b.toProps().recipientCount).toBe(120); expect(b.toProps().sentCount).toBe(118);
  });
  it('cannot mark sent straight from queued', () => { const b = make(); expect(() => b.markSent(1, 1)).toThrow(IllegalBroadcastTransitionError); });
  it('failure records the reason', () => { const b = make(); b.markFailed('no_recipients'); expect(b.status).toBe('failed'); expect(b.toProps().failureReason).toBe('no_recipients'); });
});
