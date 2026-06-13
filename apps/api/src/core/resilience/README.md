# resilience

Every external dependency is wrapped: circuit breaker (stop hammering a dead dep), bulkhead (isolate its thread/conn pool), timeout (no unbounded waits), retry (idempotent only, backoff+jitter), fallback (degrade, don't fail: search falls to DB query, AI grade falls to rule grade). This is what turns one dependency outage into 'slightly degraded' instead of 'platform down'. [P1]
