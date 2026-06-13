# backpressure & load shedding

At overload, a platform must DEGRADE not DIE. We classify every request: critical (payment, wallet, auth, place-bid) is never shed; sheddable (recommendations, analytics, non-urgent reads) is dropped first with 503+Retry-After. Concurrency limiter caps in-flight per endpoint; queue-depth guard rejects new async work when consumers fall behind. The harvest-day / festival traffic spike (PRD) is exactly this scenario. [P1]
