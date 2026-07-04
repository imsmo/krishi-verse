// Unit tests for the PURE Decline-Job logic (features/labour/decline-job) behind screen 142.
import { DECLINE_REASONS, normalizeDeclineMessage, canSendDecline } from '../../features/labour/decline-job';

describe('DECLINE_REASONS', () => {
  it('are the six design reasons in order', () => {
    expect(DECLINE_REASONS.map((r) => r.key)).toEqual(['booked', 'wage', 'far', 'health', 'family', 'farmer']);
  });
});

describe('normalizeDeclineMessage', () => {
  it('trims + collapses, caps 300, empty → null', () => {
    expect(normalizeDeclineMessage('  available   from Wednesday ')).toBe('available from Wednesday');
    expect(normalizeDeclineMessage('')).toBeNull();
    expect(normalizeDeclineMessage(null)).toBeNull();
    expect(normalizeDeclineMessage('x'.repeat(400))!.length).toBe(300);
  });
});

describe('canSendDecline', () => {
  it('needs a valid reason picked', () => {
    expect(canSendDecline('wage')).toBe(true);
    expect(canSendDecline(null)).toBe(false);
    expect(canSendDecline('nope' as never)).toBe(false);
  });
});
