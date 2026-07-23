// Unit tests for the PURE farmer HOME dashboard helpers (screen 09). No I/O.
import { walletTileMinor } from '../../features/farmer/dashboard-presenters';

// KV-MF-10 (founder video review): the Home wallet stat card degraded to "—" while the dedicated Wallet screen
// (features/wallet/index.tsx) showed the real balance for the SAME GET /v1/wallet/balance read. This locks down
// the exact field mapping Home uses — `availableMinor` on success, null (never a fabricated ₹0) on a failed read
// — so a future edit can't silently swap in the wrong field or invert the failed-flag check.
describe('walletTileMinor', () => {
  it('maps a healthy read to the SAME availableMinor field the Wallet screen renders', () => {
    expect(walletTileMinor({ availableMinor: '458000', failed: false })).toBe('458000');
  });
  it('maps a zero-but-real balance through untouched (a real ₹0 is not the same as a failed read)', () => {
    expect(walletTileMinor({ availableMinor: '0', failed: false })).toBe('0');
  });
  it('degrades a failed read to null (screen shows "—") — never fabricates ₹0', () => {
    expect(walletTileMinor({ availableMinor: '0', failed: true })).toBeNull();
  });
});
