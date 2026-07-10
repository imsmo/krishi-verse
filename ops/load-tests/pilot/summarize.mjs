#!/usr/bin/env node
// ops/load-tests/pilot/summarize.mjs (Sprint S5)
// Tiny formatter: reads a k6 `--summary-export` JSON file and prints one compact line of the metrics
// that matter for the pilot gate table (p95/p99 latency, error rate, whether every threshold held).
// Used by run-pilot-gate.sh; safe to run standalone too: `node summarize.mjs results/<ts>/order-flow.summary.json`
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node summarize.mjs <k6-summary.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const metrics = raw.metrics || {};

function pct(metric, key) {
  const v = metrics[metric]?.values;
  if (!v) return undefined;
  return v[key] ?? v[`p(${key.replace('p', '')})`];
}

function fmtMs(v) { return v === undefined ? 'n/a' : `${Math.round(v)}ms`; }

const p95 = pct('http_req_duration', 'p(95)');
const p99 = pct('http_req_duration', 'p(99)');
const errRate = metrics.flow_errors?.values?.rate ?? metrics.http_req_failed?.values?.rate;
const errPct = errRate === undefined ? 'n/a' : `${(errRate * 100).toFixed(2)}%`;
const server5xx = metrics.server_errors_5xx?.values?.count ?? 0;

let allThresholdsOk = true;
for (const [name, m] of Object.entries(metrics)) {
  if (!m.thresholds) continue;
  for (const [thr, result] of Object.entries(m.thresholds)) {
    const ok = typeof result === 'object' ? result.ok !== false : result !== false;
    if (!ok) { allThresholdsOk = false; console.error(`  threshold FAILED: ${name} ${thr}`); }
  }
}

console.log(
  `p95=${fmtMs(p95)} p99=${fmtMs(p99)} err=${errPct} 5xx=${server5xx} thresholds=${allThresholdsOk ? 'OK' : 'FAILED'}`,
);
