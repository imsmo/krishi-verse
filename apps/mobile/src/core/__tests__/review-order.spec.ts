// Unit tests for the PURE Review Order helpers (features/cart/review-order, screen 15). No React/native deps.
// These only derive UI state (payment rail, item subtitle) — they never sum money (the server owns the bill).
import { isWalletRail, isOnlineRail, railSelectable, defaultRail, checkoutItemSubtitle, type ReviewRail } from '../../features/cart/review-order';

describe('payment rails (screen 15)', () => {
  it('classifies wallet vs online rails', () => {
    expect(isWalletRail('wallet')).toBe(true);
    expect(isWalletRail('upi')).toBe(false);
    expect(isWalletRail('card')).toBe(false);
    expect(isOnlineRail('upi')).toBe(true);
    expect(isOnlineRail('card')).toBe(true);
    expect(isOnlineRail('wallet')).toBe(false);
  });

  it('wallet + online rails are mutually exclusive partitions', () => {
    const rails: ReviewRail[] = ['wallet', 'upi', 'card'];
    for (const r of rails) expect(isWalletRail(r)).toBe(!isOnlineRail(r));
  });

  it('wallet is selectable only when the balance covers the total; online always is', () => {
    expect(railSelectable('wallet', true)).toBe(true);
    expect(railSelectable('wallet', false)).toBe(false);
    expect(railSelectable('upi', false)).toBe(true);
    expect(railSelectable('card', false)).toBe(true);
  });

  it('defaults to the online (UPI) rail — never auto-selects the wallet', () => {
    expect(defaultRail()).toBe('upi');
    expect(isWalletRail(defaultRail())).toBe(false);
  });
});

describe('order-item subtitle (screen 15)', () => {
  it('joins quantity + unit label when present', () => {
    expect(checkoutItemSubtitle(2, 'quintal')).toBe('2 quintal');
    expect(checkoutItemSubtitle(10, 'kg')).toBe('10 kg');
  });
  it('falls back to bare quantity when no unit code (never fabricates grade/seller)', () => {
    expect(checkoutItemSubtitle(2)).toBe('2');
    expect(checkoutItemSubtitle(2, '')).toBe('2');
    expect(checkoutItemSubtitle(2, '   ')).toBe('2');
    expect(checkoutItemSubtitle(2, null)).toBe('2');
  });
  it('degrades a non-finite quantity to 0', () => {
    expect(checkoutItemSubtitle(NaN, 'quintal')).toBe('0 quintal');
    expect(checkoutItemSubtitle(Infinity)).toBe('0');
  });
});
