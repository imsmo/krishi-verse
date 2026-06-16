#!/usr/bin/env node
// db/scripts/explain-top-queries.js
// Weekly performance triage from pg_stat_statements — surface the heaviest queries
// (the N+1s and missing indexes) before they become an outage. At billions of ops a
// single un-indexed hot query is the difference between p99=50ms and a meltdown.
// Optionally EXPLAINs a specific statement (planner check after a release/upgrade).
//
// Requires pg_stat_statements (shared_preload_libraries + CREATE EXTENSION on the
// cluster — a one-time ops migration, not part of the app schema).
'use strict';
const { withClient } = require('./lib/db');
const { parse, helpAndExit } = require('./lib/args');
const { makeLogger } = require('./lib/log');

const HELP = `
explain-top-queries — heaviest queries from pg_stat_statements.

Usage:
  node db/scripts/explain-top-queries.js [--top 20] [--by total|mean|calls] [--json]
  node db/scripts/explain-top-queries.js --explain "SELECT ..."
  node db/scripts/explain-top-queries.js --reset`;

async function main() {
  const args = parse();
  if (args.has('help')) helpAndExit(HELP);
  const log = makeLogger('explain-top-queries');

  await withClient({ appName: 'kv-explain', statementTimeoutMs: 60000, log }, async (client) => {
    const has = await client.query(`SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements'`);
    if (has.rowCount === 0) {
      log.error('pg_stat_statements not installed', {
        fix: "shared_preload_libraries='pg_stat_statements' (restart) then CREATE EXTENSION pg_stat_statements;",
      });
      process.exitCode = 1; return;
    }
    if (args.bool('reset')) { await client.query('SELECT pg_stat_statements_reset()'); log.info('pg_stat_statements reset'); return; }

    const explainSql = args.get('explain', null);
    if (explainSql) {
      const r = await client.query(`EXPLAIN (FORMAT TEXT, VERBOSE, COSTS) ${explainSql}`);
      process.stdout.write(r.rows.map((x) => x['QUERY PLAN']).join('\n') + '\n');
      return;
    }

    const top = args.int('top', 20);
    const by = ({ total: 'total_exec_time', mean: 'mean_exec_time', calls: 'calls' })[args.get('by', 'total')] || 'total_exec_time';
    const r = await client.query(`
      SELECT calls,
             round(total_exec_time::numeric, 1)  AS total_ms,
             round(mean_exec_time::numeric, 2)   AS mean_ms,
             round(stddev_exec_time::numeric, 2) AS stddev_ms,
             rows,
             round(100.0*shared_blks_hit/nullif(shared_blks_hit+shared_blks_read,0),1) AS cache_pct,
             left(regexp_replace(query, '\\s+', ' ', 'g'), 120) AS query
      FROM pg_stat_statements ORDER BY ${by} DESC LIMIT $1`, [top]);

    if (args.has('json')) { process.stdout.write(JSON.stringify(r.rows, null, 2) + '\n'); return; }
    log.info(`top ${top} queries by ${by}`);
    for (const q of r.rows) {
      process.stdout.write(`  calls=${q.calls} total=${q.total_ms}ms mean=${q.mean_ms}ms rows=${q.rows} cache=${q.cache_pct ?? '–'}%\n    ${q.query}\n`);
    }
  });
}

main().catch((err) => { makeLogger('explain-top-queries').error('FATAL', { error: err.message }); process.exit(1); });
