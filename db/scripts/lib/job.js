// db/scripts/lib/job.js
// ops_job_runs lifecycle + concurrency guard for scheduled jobs. Wrapping a job:
//   • takes a Postgres ADVISORY LOCK keyed on the job_code so two cron pods can't
//     run the same job at once (e.g. archive racing itself);
//   • inserts a 'running' row, then marks 'succeeded'/'failed' with timing + detail;
//   • returns the fn result. If the lock is held, the job exits cleanly (skipped).
'use strict';

/** Stable 32-bit-ish key from a job code for pg_advisory_lock. */
function lockKey(jobCode) {
  let h = 5381;
  for (let i = 0; i < jobCode.length; i++) h = ((h << 5) + h + jobCode.charCodeAt(i)) | 0;
  return h;
}

async function runJob(client, jobCode, opts, fn) {
  const { lock = true, log } = opts || {};
  if (lock) {
    const got = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [lockKey(jobCode)]);
    if (!got.rows[0].ok) {
      if (log) log.warn('another run holds the job lock — skipping', { job: jobCode });
      return { skipped: true };
    }
  }
  const started = Date.now();
  const ins = await client.query(
    `INSERT INTO ops_job_runs (job_code, status, detail) VALUES ($1, 'running', '{}'::jsonb) RETURNING id`,
    [jobCode],
  );
  const jobId = ins.rows[0].id;
  const detail = {};
  const recordDetail = (k, v) => { detail[k] = v; };
  try {
    const result = await fn({ jobId, recordDetail });
    await client.query(
      `UPDATE ops_job_runs SET status='succeeded', finished_at=now(),
         detail = detail || $2::jsonb WHERE id=$1`,
      [jobId, JSON.stringify({ ...detail, duration_ms: Date.now() - started })],
    );
    return { skipped: false, jobId, result };
  } catch (err) {
    await client.query(
      `UPDATE ops_job_runs SET status='failed', finished_at=now(),
         detail = detail || $2::jsonb WHERE id=$1`,
      [jobId, JSON.stringify({ ...detail, error: err.message, duration_ms: Date.now() - started })],
    ).catch(() => {});
    throw err;
  } finally {
    if (lock) await client.query('SELECT pg_advisory_unlock($1)', [lockKey(jobCode)]).catch(() => {});
  }
}

module.exports = { runJob, lockKey };
