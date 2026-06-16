// db/scripts/__tests__/partitions.test.js
// Unit tests for the partition date/bound math — the part most likely to have an
// off-by-one that would silently archive live data or under-provision partitions.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../lib/partitions');

test('parsePartitionBound — normal monthly range', () => {
  const b = P.parsePartitionBound("FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')");
  assert.equal(b.isDefault, false);
  assert.equal(b.from, '2026-01-01');
  assert.equal(b.to, '2026-02-01');
});

test('parsePartitionBound — DEFAULT partition', () => {
  const b = P.parsePartitionBound('DEFAULT');
  assert.equal(b.isDefault, true);
  assert.equal(b.to, null);
});

test('parsePartitionBound — unparseable / null', () => {
  assert.equal(P.parsePartitionBound(null).to, null);
  assert.equal(P.parsePartitionBound('garbage').unparsed, true);
});

test('cutoffDate — first of month, N months back (UTC)', () => {
  const now = new Date('2026-06-15T10:00:00Z');
  assert.equal(P.cutoffDate(13, now).toISOString(), '2025-05-01T00:00:00.000Z');
  assert.equal(P.cutoffDate(0, now).toISOString(), '2026-06-01T00:00:00.000Z');
});

test('monthsRunway — future positive, past negative, null safe', () => {
  const now = new Date('2026-06-15T00:00:00Z');
  assert.equal(P.monthsRunway('2026-09-01', now), 3);
  assert.equal(P.monthsRunway('2026-06-01', now), 0);
  assert.equal(P.monthsRunway('2026-04-01', now), -2);
  assert.equal(P.monthsRunway(null, now), null);
});

test('partitionName — canonical YYYY_MM, strips public.', () => {
  assert.equal(P.partitionName('public.orders', new Date('2026-06-01T00:00:00Z')), 'orders_2026_06');
  assert.equal(P.partitionName('milk_collections', new Date('2026-12-01T00:00:00Z')), 'milk_collections_2026_12');
});

test('isCold — past hot window vs within window', () => {
  const now = new Date('2026-06-15T00:00:00Z');
  // active_months=12 → cutoff 2025-06-01; a partition ending 2025-05-01 is cold
  assert.equal(P.isCold('2025-05-01', 12, now), true);
  // a partition ending 2026-05-01 is still hot
  assert.equal(P.isCold('2026-05-01', 12, now), false);
  assert.equal(P.isCold(null, 12, now), false);
});
