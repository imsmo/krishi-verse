-- apps/api/test/sql/02_seed_min.sql · minimal seed for the integration test.
-- One plan with a generous listings quota, plus an active subscription per test
-- tenant is created by the test itself (tenant ids are random per run).
INSERT INTO plans (id, name) VALUES ('00000000-0000-0000-0000-0000000000a1','Test Plan')
  ON CONFLICT DO NOTHING;
INSERT INTO plan_limits (plan_id, limit_code, limit_value)
  VALUES ('00000000-0000-0000-0000-0000000000a1','max_listings_month', 1000)
  ON CONFLICT DO NOTHING;
