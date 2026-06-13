-- 0901 · STAGING-ONLY demo tenant (never run in prod) · [P1-staging]
INSERT INTO tenants (id,slug,legal_name,display_name,tenant_type_id,country_code,region_id,status,created_at)
SELECT '88888888-0000-7000-8000-000000000001','demo-fpo','Demo FPO Pvt Ltd','Junagadh Demo FPO',
  (SELECT id FROM lookup_values WHERE type_code='tenant_type' AND code='fpo' LIMIT 1),
  'IN','11111111-0000-7000-8000-000000000101','active',now()
ON CONFLICT (id) DO NOTHING;
