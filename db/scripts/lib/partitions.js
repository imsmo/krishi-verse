// db/scripts/lib/partitions.js
// PURE, unit-tested helpers for monthly-partition math (no I/O). Kept separate from
// the scripts so the tricky date/bound logic is covered by tests (see __tests__/).
'use strict';

/** Parse a Postgres partition bound expression into {from,to} ISO dates, or {isDefault}. */
function parsePartitionBound(expr) {
  if (!expr) return { isDefault: false, from: null, to: null, unparsed: true };
  if (/DEFAULT/i.test(expr)) return { isDefault: true, from: null, to: null };
  const m = expr.match(/FROM \('?(\d{4}-\d{2}-\d{2})[^)]*'?\)\s*TO \('?(\d{4}-\d{2}-\d{2})/i);
  if (!m) return { isDefault: false, from: null, to: null, unparsed: true };
  return { isDefault: false, from: m[1], to: m[2] };
}

/** First day (UTC) of the month that is `monthsBack` before the current month. */
function cutoffDate(monthsBack, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - monthsBack);
  return d;
}

/** First-of-month (UTC) for `now` offset by `delta` months. */
function monthStart(delta = 0, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d;
}

/** Whole months from `now`'s month to the month of `to` (>=0 = future runway). */
function monthsRunway(toISO, now = new Date()) {
  if (!toISO) return null;
  const to = new Date(toISO + 'T00:00:00Z');
  return (to.getUTCFullYear() - now.getUTCFullYear()) * 12 + (to.getUTCMonth() - now.getUTCMonth());
}

/** Canonical monthly partition name, e.g. orders_2026_06. */
function partitionName(parent, monthDate) {
  const p = String(parent).replace(/^public\./, '');
  const y = monthDate.getUTCFullYear();
  const m = String(monthDate.getUTCMonth() + 1).padStart(2, '0');
  return `${p}_${y}_${m}`;
}

/** True if a partition whose upper bound is `toISO` is past the hot window. */
function isCold(toISO, activeMonths, now = new Date()) {
  if (!toISO) return false;
  return new Date(toISO + 'T00:00:00Z') <= cutoffDate(activeMonths, now);
}

module.exports = { parsePartitionBound, cutoffDate, monthStart, monthsRunway, partitionName, isCold };
