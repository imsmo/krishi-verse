-- 0010 · integration providers (payments.provider_code / payouts.provider_code FK these).
-- 'sandbox' is the deterministic in-house gateway used for tests/local; real PSPs are added here.
-- Toggle is_active to disable a provider platform-wide.
INSERT INTO integration_providers (code, default_name, category, is_active) VALUES
  ('sandbox',  'Sandbox (test) gateway', 'payment', true),
  ('razorpay', 'Razorpay',               'payment', true),
  ('razorpayx','RazorpayX (payouts)',    'payment', true)
ON CONFLICT (code) DO NOTHING;
