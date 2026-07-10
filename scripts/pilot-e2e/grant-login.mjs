#!/usr/bin/env node
// scripts/pilot-e2e/grant-login.mjs
// LOCAL DEV ONLY — mirrors db/local/local-login-roles.sql exactly (same three roles, same
// hardcoded 'dev' password used throughout every local .env in docs/local-setup/), just run via
// `pg` instead of requiring the `psql` CLI to be installed (one less prerequisite for the founder).
// Migrations create kv_app/kv_wallet/kv_relay as NOLOGIN (correct for production, where the real
// password comes from Secrets Manager); on a laptop they need a LOGIN once, after `pnpm migrate`
// and before anything connects as them. Safe to re-run.
import pg from 'pg';

const { Client } = pg;
const ownerUrl = process.argv[2];
if (!ownerUrl) {
  console.error('usage: node grant-login.mjs <owner-postgres-url>');
  process.exit(1);
}

const client = new Client({ connectionString: ownerUrl });
await client.connect();
for (const role of ['kv_app', 'kv_wallet', 'kv_relay']) {
  // role names come from a fixed literal list above (never user input) — safe to inline.
  await client.query(`ALTER ROLE ${role} WITH LOGIN PASSWORD 'dev'`);
}
const r = await client.query(
  `SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname IN ('kv_app','kv_wallet','kv_relay') ORDER BY rolname`,
);
for (const row of r.rows) {
  console.log(`  ${row.rolname}: canlogin=${row.rolcanlogin} bypassrls=${row.rolbypassrls}`);
}
await client.end();
