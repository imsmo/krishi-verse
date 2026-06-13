# db/ — single source of schema truth
migrations/0001-0015 = the files in ../Database_Architecture/full_platform/
(copy them here when initialising the repo; never edit applied migrations).
seeds/core: languages, roles+permissions, units, lookup vocabularies,
            notification events/templates, consent purposes, countries/regions
seeds/catalogue: category tree, 30 launch crops, attributes/options
seeds/rules: commission/tax/charge rules, membership tiers, min wages, plans
seeds/demo: staging-only fake tenants/users (never prod)
scripts/: migrate.js, seed.js, ensure-partitions cron, archive-partitions
