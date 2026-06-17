-- 0009 · feature flags (Law 10). Default behaviour is OFF (a missing flag = off), so any
-- feature gated by @FeatureFlag must have an ENABLED row here to be reachable. Toggle
-- is_enabled=false for an instant kill-switch; use rollout_pct / rules.tenant_ids to stage.
INSERT INTO feature_flags (key, description, is_enabled, rollout_pct, rules) VALUES
  ('listing_boost', 'Paid listing visibility boosts', true, 100, '{}'),
  ('group_lots',    'FPO group-lot pooling',          true, 100, '{}'),
  ('kyc',           'KYC document submission + review', true, 100, '{}'),
  ('product_batches','Regulated-input store inventory batches', true, 100, '{}'),
  ('online_payments','Online payment at checkout (wallet-service) — OFF until payments lands', false, 100, '{}')
ON CONFLICT (key) DO NOTHING;
