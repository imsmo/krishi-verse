# infra/terraform/envs/prod/dr.tf · DISASTER RECOVERY — intentionally deferred to the P0-7 DR wave.
#
# Not a silent stub: this file is deliberately empty pending the DR build, which will add:
#   - cross-region (ap-south-2) Aurora global database secondary + automated promotion runbook
#   - S3 cross-region replication for the media bucket
#   - KMS multi-region key (or replica key) for the DR region
#   - Route 53 health-check based failover records
# Tracked in docs/production-backlog/P0-launch-blockers.md (P0-7) and infra/terraform/PROGRESS-P0-1.md.
