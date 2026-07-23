// ivr-ussd-gateway — INTENTIONALLY UNIMPLEMENTED (GA-deferred placeholder entrypoint).
//
// Disposition: POST-GA channels wave. Requires a telephony/USSD provider agreement; D15 IVR/USSD flow specs are the product contract.
//
// S6-prep note: the S0 hygiene sweep removed this app's ghost `export {}` scaffold files
// (they falsely signalled in-progress work). This single honest entrypoint remains so the
// package still typechecks and `turbo build` stays green across the workspace. Replace it
// with the real implementation when the wave lands — see docs/production-backlog + the S0
// classification memo (Development_Program/S0_CLASSIFICATION_MEMO.md) for disposition.
/* eslint-disable no-console */
console.error('[ivr-ussd-gateway] not implemented — GA-deferred. See Development_Program/S0_CLASSIFICATION_MEMO.md');
process.exit(1);
