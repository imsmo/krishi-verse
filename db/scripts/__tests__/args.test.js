// db/scripts/__tests__/args.test.js · CLI parser contract.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../lib/args');

test('boolean flags, valued flags, = form, positionals', () => {
  const a = parse(['--apply', '--months', '3', '--by=total', 'extra']);
  assert.equal(a.bool('apply'), true);
  assert.equal(a.int('months', 1), 3);
  assert.equal(a.get('by'), 'total');
  assert.deepEqual(a.positional, ['extra']);
});

test('defaults + has()', () => {
  const a = parse([]);
  assert.equal(a.has('json'), false);
  assert.equal(a.get('by', 'total'), 'total');
  assert.equal(a.int('top', 20), 20);
  assert.equal(a.bool('apply'), false);
});

test('a flag immediately before another flag is boolean', () => {
  const a = parse(['--apply', '--json']);
  assert.equal(a.bool('apply'), true);
  assert.equal(a.bool('json'), true);
});
