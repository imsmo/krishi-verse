# Database (migrations, seeds, scripts, DBA)

58 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `README.md`

### `db/README.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan


---
## `dba`

### `db/dba/bloat-check.sql` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/capacity-forecast.md` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/connection-audit.sql` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** Law8 partition pruning
- **Priority:** see build plan

### `db/dba/failover-runbook.md` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/index-review.sql` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/locks-monitor.sql` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/partition-health.sql` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/pg-upgrade-runbook.md` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/rds-proxy-config.md` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/dba/replication-lag.sql` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/rls-verify.sql` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/slow-queries-weekly.sql` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan

### `db/dba/vacuum-analyze-policy.md` 
- **Layer:** DBA Pack
- **Implement:** DBA operations: vacuum policy, index/slow-query/lock/bloat reviews, partition & replication health, failover & upgrade runbooks, RLS verify, connection audit. 
- **Laws:** general
- **Priority:** see build plan


---
## `migrations`

### `db/migrations/0001_foundation.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0002_tenancy_billing.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0003_identity_access.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0004_catalogue_dynamic.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/migrations/0005_commerce.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0006_money.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0007_logistics.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0008_labour.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0009_livestock_dairy.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0010_agri_infra_services.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `db/migrations/0011_fintech_schemes.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0012_engagement.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0013_growth_intelligence.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0014_platform_ops_security.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** general
- **Priority:** Wave 0/1

### `db/migrations/0015_audit_additions.sql` 
- **Layer:** DB Migration
- **Implement:** Baseline = the 14 Database_Architecture SQL files (already authored). Forward changes are NEW numbered migrations via PR (never edit applied ones). Wallet/ledger migrations need CODEOWNERS review. 
- **Laws:** Law8 partition pruning
- **Priority:** Wave 0/1


---
## `scripts`

### `db/scripts/archive-partitions.js` 
- **Layer:** DB Script
- **Implement:** Operational script: migrate runner / seed runner / ensure-partitions / archive-partitions / verify-rls / explain-top-queries. 
- **Laws:** general
- **Priority:** see build plan

### `db/scripts/ensure-partitions.js` 
- **Layer:** DB Script
- **Implement:** Operational script: migrate runner / seed runner / ensure-partitions / archive-partitions / verify-rls / explain-top-queries. 
- **Laws:** general
- **Priority:** see build plan

### `db/scripts/explain-top-queries.js` 
- **Layer:** DB Script
- **Implement:** Operational script: migrate runner / seed runner / ensure-partitions / archive-partitions / verify-rls / explain-top-queries. 
- **Laws:** general
- **Priority:** see build plan

### `db/scripts/migrate.js` 
- **Layer:** DB Script
- **Implement:** Operational script: migrate runner / seed runner / ensure-partitions / archive-partitions / verify-rls / explain-top-queries. 
- **Laws:** general
- **Priority:** see build plan

### `db/scripts/seed.js` 
- **Layer:** DB Script
- **Implement:** Operational script: migrate runner / seed runner / ensure-partitions / archive-partitions / verify-rls / explain-top-queries. 
- **Laws:** Law6 dynamic data not code
- **Priority:** see build plan

### `db/scripts/verify-rls-coverage.js` 
- **Layer:** DB Script
- **Implement:** Operational script: migrate runner / seed runner / ensure-partitions / archive-partitions / verify-rls / explain-top-queries. 
- **Laws:** general
- **Priority:** see build plan


---
## `seeds`

### `db/seeds/catalogue/0101_category_tree.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/catalogue/0102_attributes_options.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/catalogue/0103_launch_crops_30.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/catalogue/0104_attribute_templates.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** Wave 0/1

### `db/seeds/catalogue/0105_search_synonyms.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/core/0001_languages.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/core/0002_countries_regions_gj_mh.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/core/0003_currencies_units.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/core/0004_roles_permissions.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/core/0005_lookup_vocabularies.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/core/0006_consent_purposes.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/core/0007_notification_events_templates.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys, Law8 partition pruning
- **Priority:** Wave 0/1

### `db/seeds/core/0008_setting_definitions.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/demo/0901_demo_tenants.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/demo/0902_demo_users_listings.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/rules/0201_plans_limits_features.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/rules/0202_commission_rules.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law2 BIGINT money, Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/rules/0203_tax_rules_gst_tds.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/rules/0204_charge_definitions.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/rules/0205_membership_tiers.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/rules/0206_minimum_wages_gj_mh.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/rules/0207_ambassador_commission_plans.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law2 BIGINT money, Law6 dynamic data not code
- **Priority:** Wave 0/1

### `db/seeds/rules/0208_schemes_starter_set.sql` ✅ DONE — reference/seeded
- **Layer:** DB Seed
- **Implement:** DONE — real INSERTs (languages, roles+permissions, geo, units, lookups, category tree, crops, commission/tax/charge rules, plans, membership tiers, min wages, notification templates, schemes, synonyms). Extend via admin UI, not new seeds. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1
