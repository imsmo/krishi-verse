# Runbook: partition runway low / partition job failed

**Page source:** `PartitionRunwayLow` (<3 days) / `OutboxBacklogGrowing`.
1. Manually create runway now: `pnpm db:partitions` (ensure-partitions) against the writer.
2. Find why the scheduled job didn't run — **NOTE:** the worker-runtime host is currently a scaffold (flagged
   P0-9); until it's deployed, partition + outbox-relay + retention jobs must be run manually / via cron.
3. Outbox backlog: confirm the relay is dispatching; if not, run it manually and investigate the consumer.
