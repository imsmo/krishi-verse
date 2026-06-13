# sharding

Tenant is the shard key (99% of queries are intra-tenant). Phase 1-2 = single cluster, shard_count=1, router is a no-op. Phase 3+ = flip shard_count, backfill, route. App code is ALREADY written through the router so the day it matters is config, not rewrite. Options: Citus / Aurora Limitless / app-level. [P3]
