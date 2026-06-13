// modules/listings/__tests__/listing.state.spec.ts · the state machine is correctness-critical.
import { canTransition, assertTransition, allowedNext, isPurchasable } from '../domain/listing.state';
import { IllegalListingTransitionError } from '../domain/listing.errors';

describe('listing state machine', () => {
  it('allows draft→published', () => expect(canTransition('draft', 'published')).toBe(true));
  it('forbids draft→sold_out', () => expect(canTransition('draft', 'sold_out')).toBe(false));
  it('forbids leaving terminal archived', () => expect(allowedNext('archived')).toHaveLength(0));
  it('assertTransition throws typed error on illegal move', () =>
    expect(() => assertTransition('draft', 'sold_out')).toThrow(IllegalListingTransitionError));
  it('only published is purchasable', () => {
    expect(isPurchasable('published')).toBe(true);
    expect(isPurchasable('paused')).toBe(false);
  });
});
