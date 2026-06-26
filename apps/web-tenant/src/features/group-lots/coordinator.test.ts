// apps/web-tenant/src/features/group-lots/coordinator.test.ts · pure unit tests for the group-lot coordinator helpers.
import {
  coordinatorActions, canPledge, validateCreate, validatePledge, validateSettle,
  parseQtyMilli, formatQtyMilli, progressBps, previewSettlement,
} from './coordinator';

describe('group-lots/coordinator — action state machine', () => {
  it('offers the right next actions per status (mirrors group-lot.state)', () => {
    expect(coordinatorActions('pledging')).toEqual(['pledge', 'ready', 'cancel']);
    expect(coordinatorActions('ready')).toEqual(['settle', 'cancel']);
    expect(coordinatorActions('listed')).toEqual(['settle', 'cancel']);
    expect(coordinatorActions('sold')).toEqual(['settle']);
    expect(coordinatorActions('settled')).toEqual([]);
    expect(coordinatorActions('cancelled')).toEqual([]);
  });
  it('canPledge only while pledging and before the deadline', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 1000).toISOString();
    expect(canPledge('pledging', future)).toBe(true);
    expect(canPledge('pledging', past)).toBe(false);
    expect(canPledge('ready', future)).toBe(false);
  });
});

describe('group-lots/coordinator — validators (float-free, ReDoS-safe)', () => {
  const deadline = '2026-08-01T00:00';
  it('validateCreate bounds product/target/unit/deadline/fee', () => {
    expect(validateCreate({ productId: '', targetQuantity: '100', unitCode: 'kg', pledgeDeadline: deadline })).toBe('product');
    expect(validateCreate({ productId: 'p1', targetQuantity: '0', unitCode: 'kg', pledgeDeadline: deadline })).toBe('target');
    expect(validateCreate({ productId: 'p1', targetQuantity: 'x', unitCode: 'kg', pledgeDeadline: deadline })).toBe('target');
    expect(validateCreate({ productId: 'p1', targetQuantity: '100', unitCode: '', pledgeDeadline: deadline })).toBe('unit');
    expect(validateCreate({ productId: 'p1', targetQuantity: '100', unitCode: 'kg', pledgeDeadline: 'bad' })).toBe('deadline');
    expect(validateCreate({ productId: 'p1', targetQuantity: '100', unitCode: 'kg', pledgeDeadline: deadline, coordinationFeeBps: '20000' })).toBe('fee');
    expect(validateCreate({ productId: 'p1', targetQuantity: '100.500', unitCode: 'kg', pledgeDeadline: deadline, coordinationFeeBps: '500' })).toBeNull();
  });
  it('validatePledge bounds farmer + quantity', () => {
    expect(validatePledge({ farmerUserId: '', quantity: '25' })).toBe('farmer');
    expect(validatePledge({ farmerUserId: 'f1', quantity: '0' })).toBe('quantity');
    expect(validatePledge({ farmerUserId: 'f1', quantity: '25.5' })).toBeNull();
  });
  it('validateSettle requires positive minor amount', () => {
    expect(validateSettle('0')).toBe('gross');
    expect(validateSettle('1.5')).toBe('gross');
    expect(validateSettle('100000')).toBeNull();
  });
});

describe('group-lots/coordinator — float-free quantity + progress', () => {
  it('parses + formats milli-units', () => {
    expect(parseQtyMilli('12.5')).toBe(12500n);
    expect(parseQtyMilli('100')).toBe(100000n);
    expect(formatQtyMilli(12500n)).toBe('12.500');
  });
  it('progressBps clamps to 10000', () => {
    expect(progressBps('50', '100')).toBe(5000);
    expect(progressBps('150', '100')).toBe(10000);
    expect(progressBps('0', '100')).toBe(0);
  });
});

describe('group-lots/coordinator — settlement preview MIRRORS the server (zero-loss)', () => {
  it('splits net proportionally and sums EXACTLY to net (leftover to largest-qty first)', () => {
    const r = previewSettlement({ grossProceedsMinor: '100000', coordinationFeeBps: 500, pledges: [
      { id: 'a', quantity: '1' }, { id: 'b', quantity: '1' }, { id: 'c', quantity: '1' },
    ] });
    expect(r.coordinationFeeMinor).toBe('5000');
    expect(r.netMinor).toBe('95000');
    const sum = r.shares.reduce((acc, s) => acc + BigInt(s.shareMinor), 0n);
    expect(sum).toBe(95000n);
    expect(r.shares.map((s) => s.shareMinor).sort()).toEqual(['31666', '31667', '31667'].sort());
  });
  it('weights shares by quantity', () => {
    const r = previewSettlement({ grossProceedsMinor: '90000', coordinationFeeBps: 0, pledges: [
      { id: 'big', quantity: '2' }, { id: 'small', quantity: '1' },
    ] });
    expect(r.shares.find((s) => s.id === 'big')!.shareMinor).toBe('60000');
    expect(r.shares.find((s) => s.id === 'small')!.shareMinor).toBe('30000');
  });
  it('single non-zero pledge takes the whole net', () => {
    const r = previewSettlement({ grossProceedsMinor: '1000', coordinationFeeBps: 0, pledges: [{ id: 'a', quantity: '0.001' }] });
    expect(r.shares[0].shareMinor).toBe('1000');
  });
  it('zero total quantity → all zero shares (no divide-by-zero)', () => {
    const r = previewSettlement({ grossProceedsMinor: '1000', coordinationFeeBps: 0, pledges: [{ id: 'a', quantity: '0.000' }, { id: 'b', quantity: '0' }] });
    expect(r.shares.map((s) => s.shareMinor)).toEqual(['0', '0']);
  });
});
