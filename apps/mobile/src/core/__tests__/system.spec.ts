// Unit tests for the PURE system/search logic (features/system/system). No React/native deps (SDK/ui types are
// type-only). Covers global-search merge + local filter (ReDoS-safe), semver compare + forced-update decision,
// the permission catalog key builders, and DPDP delete-confirmation. The server owns search authority, DPDP, and
// the minimum supported version — these helpers only drive the UI.
import {
  normalizeQuery, mergeSearchResults, compareVersions, isUpdateRequired,
  PERMISSIONS, permissionTitleKey, permissionWhyKey, deleteConfirmationOk,
} from '../../features/system/system';
import type { ListingCard, OrderListItem } from '@krishi-verse/sdk-js';

const listing = (over: Partial<ListingCard>): ListingCard => ({
  id: 'l1', title: 'Tomato', priceMinor: '1000', currencyCode: 'INR', unitCode: 'kg', quantityAvailable: 5,
  organicClaim: false, saleType: 'fixed', regionId: null, sellerUserId: 'u1', boosted: false, ...over,
});
const order = (over: Partial<OrderListItem>): OrderListItem => ({ id: 'o1', orderNo: 'ORD-1', status: 'placed', totalMinor: '5000', counterparty: 'Ram', ...over });

describe('normalizeQuery', () => {
  it('trims, collapses, lowercases, caps', () => {
    expect(normalizeQuery('  Tom  ato ')).toBe('tom ato');
    expect(normalizeQuery(null)).toBe('');
    expect(normalizeQuery('x'.repeat(120)).length).toBe(80);
  });
});

describe('mergeSearchResults', () => {
  it('filters listings by title + orders by no/status/counterparty; listings first', () => {
    const hits = mergeSearchResults([listing({ id: 'a', title: 'Tomato' }), listing({ id: 'b', title: 'Wheat' })], [order({ id: 'o', orderNo: 'ORD-9', status: 'placed', counterparty: 'Tomato Traders' })], 'tomato');
    expect(hits.map((h) => `${h.kind}:${h.id}`)).toEqual(['listing:a', 'order:o']);
  });
  it('treats the query as a literal (no regex injection)', () => {
    expect(mergeSearchResults([listing({ title: 'a.b' })], [], '.*')).toEqual([]);
  });
  it('empty query returns everything (capped)', () => {
    const many = Array.from({ length: 60 }, (_, i) => listing({ id: `l${i}`, title: `t${i}` }));
    expect(mergeSearchResults(many, [], '').length).toBe(50);
  });
});

describe('compareVersions / isUpdateRequired', () => {
  it('compares numerically', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });
  it('forces update only when a min is set and current is below it', () => {
    expect(isUpdateRequired('1.0.0', undefined)).toBe(false);
    expect(isUpdateRequired('1.0.0', null)).toBe(false);
    expect(isUpdateRequired('1.0.0', '1.2.0')).toBe(true);
    expect(isUpdateRequired('1.3.0', '1.2.0')).toBe(false);
  });
});

describe('permission catalog', () => {
  it('has entries with stable key builders', () => {
    expect(PERMISSIONS.length).toBeGreaterThan(0);
    expect(permissionTitleKey('camera')).toBe('system.permissions.camera.title');
    expect(permissionWhyKey('location')).toBe('system.permissions.location.why');
  });
});

describe('deleteConfirmationOk', () => {
  it('matches the expected word case-insensitively; rejects mismatch/blank', () => {
    expect(deleteConfirmationOk('delete', 'DELETE')).toBe(true);
    expect(deleteConfirmationOk('  DELETE ', 'DELETE')).toBe(true);
    expect(deleteConfirmationOk('nope', 'DELETE')).toBe(false);
    expect(deleteConfirmationOk('', 'DELETE')).toBe(false);
    expect(deleteConfirmationOk('delete', '')).toBe(false);
  });
});
