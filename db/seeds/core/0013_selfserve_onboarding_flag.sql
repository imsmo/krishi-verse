-- 0013 · feature flag for self-serve role onboarding (KV-BL-066, Sprint S3).
-- Added as its OWN file rather than appended to 0009_feature_flags.sql, which has
-- uncommitted founder edits in the working tree (do not touch it) — same idempotent
-- ON CONFLICT pattern as every other flags insert (Law 10).
-- Default ON: this closes a pilot-blocking gap (a fresh OTP-verified user had a bare
-- `users` row and could not become a farmer or buyer without an admin hitting the
-- identity.approve-gated POST /v1/rbac/assignments). Flip is_enabled=false for an
-- instant kill-switch if self-serve grants are abused.
INSERT INTO feature_flags (key, description, is_enabled, rollout_pct, rules) VALUES
  ('selfserve_onboarding',
   'Self-serve POST /v1/onboarding/roles: an OTP-authenticated user can grant themselves farmer or customer in their own tenant without admin approval (pilot scope only — every other role code stays invite-only or GA-gated) — kill-switch if abused',
   true, 100, '{}')
ON CONFLICT (key) DO NOTHING;
