#!/usr/bin/env node
// db/scripts/verify-rls-coverage.js
// TENANT-ISOLATION MERGE GATE + nightly alarm. The platform's #1 invariant is that
// no tenant can read another tenant's rows. This asserts, against the live schema:
//   1. v_tables_without_rls is EMPTY — no tenant-scoped table lacks an RLS policy;
//   2. every RLS-enabled tenant table is also FORCED (so the table owner can't bypass);
//   3. the money tables (ledger/wallet) intentionally have NO RLS but ARE protected
//      by role grants — positive control that they're not world-readable by kv_app.
// Exits non-zero (CI fails) if any check fails. Read-only; safe to run anywhere.
'use strict';
const { withClient } = require('./lib/db');
const { parse, helpAndExit } = require('./lib/args');
const { makeLogger } = require('./lib/log');

const HELP = `
verify-rls-coverage — assert tenant isolation is enforced by the database.
Usage: node db/scripts/verify-rls-coverage.js [--json]
Exit 0 = all good; exit 1 = a coverage gap (block the merge/deploy).`;

const MONEY_TABLES = ['wallet_accounts', 'ledger_entries', 'ledger_transactions', 'reconciliation_runs'];

async function main() {
  const args = parse();
  if (args.has('help')) helpAndExit(HELP);
  const log = makeLogger('verify-rls-coverage');

  const report = await withClient({ appName: 'kv-rls-verify', statementTimeoutMs: 30000, log }, async (client) => {
    const gaps = (await client.query('SELECT tablename FROM v_tables_without_rls ORDER BY 1')).rows.map((r) => r.tablename);
    const notForced = (await client.query(`
      SELECT c.relname AS t
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
      JOIN information_schema.columns col
        ON col.table_schema='public' AND col.table_name=c.relname AND col.column_name='tenant_id'
      WHERE c.relkind IN ('r','p') AND c.relrowsecurity AND NOT c.relforcerowsecurity
      ORDER BY 1`)).rows.map((r) => r.t);
    const policyCount = (await client.query(`SELECT count(*)::int n FROM pg_policies WHERE schemaname='public'`)).rows[0].n;
    // Positive control: money tables must NOT be granted to the app role kv_app.
    const moneyLeaks = (await client.query(`
      SELECT table_name FROM information_schema.role_table_grants
      WHERE grantee='kv_app' AND privilege_type='SELECT' AND table_name = ANY($1)`, [MONEY_TABLES]))
      .rows.map((r) => r.table_name);
    return { gaps, notForced, policyCount, moneyLeaks };
  });

  let ok = true;
  if (report.gaps.length) { ok = false; log.error('tenant tables WITHOUT an RLS policy', { tables: report.gaps }); }
  if (report.notForced.length) { ok = false; log.error('RLS enabled but NOT forced (owner can bypass)', { tables: report.notForced }); }
  if (report.moneyLeaks.length) { ok = false; log.error('money tables granted to kv_app (should be wallet-service only)', { tables: report.moneyLeaks }); }
  if (ok) log.info('RLS coverage complete', { policies: report.policyCount });

  if (args.has('json')) process.stdout.write(JSON.stringify({ ok, ...report }, null, 2) + '\n');
  process.exitCode = ok ? 0 : 1;
}

main().catch((err) => { makeLogger('verify-rls-coverage').error('FATAL', { error: err.message }); process.exit(1); });
