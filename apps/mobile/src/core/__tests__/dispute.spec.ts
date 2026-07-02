// Unit tests for the PURE dispute-form logic (screen 135).
import { composeDisputeNote, canSubmitDispute } from '../../features/orders/dispute';

describe('report order issue (screen 135)', () => {
  it('composeDisputeNote joins non-empty segments with blank lines, bounded', () => {
    expect(composeDisputeNote(['Issue: Quality', 'Requested: Partial refund', 'moisture 13.5%']))
      .toBe('Issue: Quality\n\nRequested: Partial refund\n\nmoisture 13.5%');
    expect(composeDisputeNote(['  ', null, 'only this'])).toBe('only this');
    expect(composeDisputeNote(['x'.repeat(3000)]).length).toBe(2000);
  });
  it('canSubmitDispute needs a reason + a ≥5-char description', () => {
    expect(canSubmitDispute('quality', 'moisture too high')).toBe(true);
    expect(canSubmitDispute(null, 'moisture too high')).toBe(false);
    expect(canSubmitDispute('quality', 'bad')).toBe(false);
    expect(canSubmitDispute('quality', '   ')).toBe(false);
  });
});
