// outbox-relay — INTENTIONALLY UNIMPLEMENTED (GA-deferred placeholder entrypoint).
//
// Disposition: GA extraction target. The REAL outbox relay runs IN-PROCESS in apps/api (core/outbox/relay.runner.ts, Sprint S1) per the ADR-0001 amendment — this standalone service is deliberately empty until relay throughput justifies extraction.
//
// S6-prep note: the S0 hygiene sweep removed this app's ghost `export {}` scaffold files
// (they falsely signalled in-progress work). This single honest entrypoint remains so the
// package still typechecks and `turbo build` stays green across the workspace. Replace it
// with the real implementation when the wave lands — see docs/production-backlog + the S0
// classification memo (Development_Program/S0_CLASSIFICATION_MEMO.md) for disposition.
/* eslint-disable no-console */
console.error('[outbox-relay] not implemented — GA-deferred. See Development_Program/S0_CLASSIFICATION_MEMO.md');
process.exit(1);
