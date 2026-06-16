#!/usr/bin/env node
// db/scripts/ensure-partitions.js
// Keeps every partitioned table supplied with future monthly partitions so a write
// can never land on a missing partition at billion-row scale. Calls the in-DB
// ensure_partitions() procedure (which discovers partitioned tables dynamically),
// then VERIFIES the post-condition: every partitioned parent must have at least
// --min-runway months of future partitions. Designed to run from a monthly k8s
// CronJob (and once on deploy). Concurrency-guarded via an advisory lock; the run
// is recorded in ops_job_runs; emits structured logs + JSON for alerting.
'use strict';
const { withClient } = require('./lib/db');
const { runJob } = require('./lib/job');
const { parse, helpAndExit } = require('./lib/args');
const { makeLogger } = require('./lib/log');
const { parsePartitionBound, monthsRunway } = require('./lib/partitions');

const HELP = `
ensure-partitions — create future monthly partitions on all partitioned tables.

Usage: node db/scripts/ensure-partitions.js [options]
  --months <n>       months ahead to create (default 3)
  --min-runway <n>   required future months; warn/fail below (default 2)
  --strict           exit 1 if any table is below --min-runway after running
  --json             emit a JSON summary
  --help
Env: MIGRATION_DATABASE_URL | DATABASE_URL (DDL-capable role), PGSSLMODE, LOG_FORMAT=json`;

async function partitionRunway(client) {
  const { rows } = await client.query(`
    SELECT i.inhparent::regclass::text AS parent,
           pg_get_expr(c.relpartbound, c.oid)  AS bound
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid`);
  const byParent = new Map();
  for (const r of rows) {
    const b = parsePartitionBound(r.bound);
    if (b.isDefault || !b.to) continue;
    const cur = byParent.get(r.parent);
    if (!cur || b.to > cur) byParent.set(r.parent, b.to);
  }
  return [...byParent.entries()].map(([parent, newestTo]) => ({ parent, newestTo, runway: monthsRunway(newestTo) }));
}

async function main() {
  const args = parse();
  if (args.has('help')) helpAndExit(HELP);
  const months = args.int('months', 3);
  const minRunway = args.int('min-runway', 2);
  const log = makeLogger('ensure-partitions');

  const summary = await withClient({ appName: 'kv-ensure-partitions', statementTimeoutMs: 120000, log }, (client) =>
    runJob(client, 'create_partitions', { log }, async ({ recordDetail }) => {
      const before = (await client.query('SELECT count(*)::int n FROM pg_inherits')).rows[0].n;
      log.info('calling ensure_partitions', { months });
      await client.query('CALL ensure_partitions($1)', [months]);
      const after = (await client.query('SELECT count(*)::int n FROM pg_inherits')).rows[0].n;

      const runway = await partitionRunway(client);
      const below = runway.filter((r) => r.runway !== null && r.runway < minRunway);
      recordDetail('partitions_before', before);
      recordDetail('partitions_after', after);
      recordDetail('created', after - before);
      recordDetail('parents_checked', runway.length);
      recordDetail('below_min_runway', below.map((b) => b.parent));

      for (const b of below) log.warn('partition runway below minimum', { parent: b.parent, runway: b.runway, min: minRunway });
      log.info('done', { created: after - before, parents: runway.length, below: below.length });
      return { months, before, after, created: after - before, parents: runway.length, below };
    }),
  );

  const r = summary.result || {};
  if (args.has('json')) process.stdout.write(JSON.stringify({ ...r }, null, 2) + '\n');
  if (args.has('strict') && r.below && r.below.length) process.exitCode = 1;
}

main().catch((err) => { makeLogger('ensure-partitions').error('FATAL', { error: err.message }); process.exit(1); });
