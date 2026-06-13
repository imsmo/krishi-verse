# bulk operations

Tenant onboarding imports 5,000 farmers via CSV; payout batches pay 50,000 workers; campaigns notify millions. All bulk work is: chunked (never one giant txn), resumable (checkpoint per chunk), idempotent per row (re-run safe), async (job id + progress), and rate-aware (respects backpressure). Results downloadable with per-row status. [P1]
