// db/scripts/lib/log.js
// Structured logger for operational scripts. Emits JSON in non-TTY/CI (LOG_FORMAT=json
// or piped) so logs are queryable in CloudWatch/Datadog; pretty lines in an interactive
// terminal. Every line carries a script name + ISO timestamp + level, and optional
// structured fields. A child logger pins fields (e.g. a run id) onto every line.
'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const THRESHOLD = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 20;
const JSON_MODE = process.env.LOG_FORMAT === 'json' || !process.stdout.isTTY;

function emit(script, level, base, msg, fields) {
  if (LEVELS[level] < THRESHOLD) return;
  const rec = { ts: new Date().toISOString(), level, script, msg, ...base, ...(fields || {}) };
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (JSON_MODE) { stream.write(JSON.stringify(rec) + '\n'); return; }
  const tag = { debug: 'DBG', info: 'INF', warn: 'WRN', error: 'ERR' }[level];
  const extra = { ...base, ...(fields || {}) };
  const kv = Object.keys(extra).length ? '  ' + Object.entries(extra).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ') : '';
  stream.write(`${rec.ts} ${tag} [${script}] ${msg}${kv}\n`);
}

function makeLogger(script, base = {}) {
  return {
    debug: (m, f) => emit(script, 'debug', base, m, f),
    info: (m, f) => emit(script, 'info', base, m, f),
    warn: (m, f) => emit(script, 'warn', base, m, f),
    error: (m, f) => emit(script, 'error', base, m, f),
    child: (extra) => makeLogger(script, { ...base, ...extra }),
  };
}

module.exports = { makeLogger };
