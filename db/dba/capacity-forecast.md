# Capacity Forecast

How to project storage/compute and decide WHEN to scale or shard. Re-run quarterly
and before any major campaign (harvest season, festival push).

## The volume drivers (model these first)
| Table | Rows per active user/tenant per month | Why it dominates |
|---|---|---|
| `ledger_entries` | ≥ 2 per money event (double-entry) | financial truth; kept 10yr (RBI) |
| `notifications` | tens–hundreds per user | every SMS/push/in-app |
| `order_events` / `*_events` | ~3× the parent row | full state-machine history |
| `milk_collections` | 2/day per dairy farmer (daily partitions) | huge at dairy scale |
| `audit_log` | every admin/state mutation | compliance, 6yr |

## Method
1. Pull last 3 months of growth from `pg_total_relation_size()` per partitioned parent
   (see `dba/partition-health.sql` #2) → bytes/month per table.
2. Project per active-user and per-tenant ratios from current cohorts.
3. Multiply by the growth plan (users, tenants, GMV). Add 30% headroom.
4. Storage runway = (instance max storage − current) ÷ monthly growth.

## Decision triggers (write these into alerts)
- **Storage**: < 6 months runway → grow volume / tier up.
- **Write IOPS / CPU**: sustained > 70% on the primary → add read replicas (offload
  reads), tune hot queries (`dba/slow-queries-weekly.sql`), then consider sharding.
- **Single-cluster ceiling**: when `ledger_entries` or `orders` approach ~1 TB or the
  primary's write throughput saturates → execute the **sharding plan** (tenant-hash via
  the existing `ShardRouter`; the app already routes every write through it). Shard by
  `tenant_id` range for easy tenant migration.
- **Connections**: pool utilisation (`dba/connection-audit.sql`) > 80% → scale the
  proxy/pool, not `max_connections`.

## Cold storage
Old partitions are archived to S3 parquet per `data_retention_policies`
(`db/scripts/archive-partitions.js`), keeping the hot cluster small. Factor archived
volume separately (cheap) from hot volume (expensive).
