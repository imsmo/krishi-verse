// analytics-pipeline — INTENTIONALLY UNIMPLEMENTED (GA-deferred placeholder entrypoint).
//
// Disposition: GA-ONLY. Requires managed Kafka + ClickHouse/dbt infra (skipped at pilot by design — see S1 staging composition); pairs with the stream-processor cutover.
//
// S6-prep note: the S0 hygiene sweep removed this app's ghost `export {}` scaffold files
// (they falsely signalled in-progress work). This single honest entrypoint remains so the
// package still typechecks and `turbo build` stays green across the workspace. Replace it
// with the real implementation when the wave lands — see docs/production-backlog + the S0
// classification memo (Development_Program/S0_CLASSIFICATION_MEMO.md) for disposition.
/* eslint-disable no-console */
console.error('[analytics-pipeline] not implemented — GA-deferred. See Development_Program/S0_CLASSIFICATION_MEMO.md');
process.exit(1);
