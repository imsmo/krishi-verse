// db/scripts/lib/db.js
// Hardened Postgres connection factory for operational scripts. Production rules:
//   • timeouts ALWAYS set (statement, lock, idle-in-transaction) so a wedged ops
//     query can never hold a lock and stall the writer at scale;
//   • connect with bounded exponential backoff (transient DNS/failover blips);
//   • SSL honoured via PGSSLMODE; application_name set for pg_stat_activity;
//   • withClient() guarantees the connection is always closed.
// Connection: MIGRATION_DATABASE_URL (DDL/owner) or DATABASE_URL.
'use strict';
const { Client } = require('pg');

function connectionString() {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set MIGRATION_DATABASE_URL or DATABASE_URL');
  return url;
}

function sslOption() {
  const mode = process.env.PGSSLMODE;
  if (!mode || mode === 'disable') return false;
  return { rejectUnauthorized: mode === 'verify-full' || mode === 'verify-ca' };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectWithRetry(client, { retries = 4, baseDelayMs = 250, log } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { await client.connect(); return; }
    catch (err) {
      if (attempt >= retries) throw err;
      const delay = Math.min(baseDelayMs * 2 ** attempt, 4000);
      if (log) log.warn('db connect failed, retrying', { attempt: attempt + 1, delay_ms: delay, error: err.message });
      await sleep(delay);
    }
  }
}

/**
 * Open a hardened client, run fn(client), always close.
 * opts: { appName, statementTimeoutMs, lockTimeoutMs, idleTxTimeoutMs, log }
 */
async function withClient(opts, fn) {
  const {
    appName = 'kv-ops',
    statementTimeoutMs = 60000,
    lockTimeoutMs = 5000,
    idleTxTimeoutMs = 15000,
    log,
  } = opts || {};
  const client = new Client({ connectionString: connectionString(), ssl: sslOption(), application_name: appName });
  await connectWithRetry(client, { log });
  try {
    await client.query(`SET statement_timeout = ${Number(statementTimeoutMs)}`);
    await client.query(`SET lock_timeout = ${Number(lockTimeoutMs)}`);
    await client.query(`SET idle_in_transaction_session_timeout = ${Number(idleTxTimeoutMs)}`);
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { withClient, connectWithRetry, connectionString, sslOption };
