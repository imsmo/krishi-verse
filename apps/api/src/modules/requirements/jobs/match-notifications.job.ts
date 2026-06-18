// modules/requirements/jobs/match-notifications.job.ts
// DEFERRED (explicitly flagged, not faked): periodically match OPEN requirements to fresh listings and
// nudge buyers/sellers. Depends on the communication/notifications module (not yet built); lands in the
// engagement wave alongside listing-published.handler.ts. Not wired into apps/worker yet.
export {};
