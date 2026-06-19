-- 0009 · feature flags (Law 10). Default behaviour is OFF (a missing flag = off), so any
-- feature gated by @FeatureFlag must have an ENABLED row here to be reachable. Toggle
-- is_enabled=false for an instant kill-switch; use rollout_pct / rules.tenant_ids to stage.
INSERT INTO feature_flags (key, description, is_enabled, rollout_pct, rules) VALUES
  ('listing_boost', 'Paid listing visibility boosts', true, 100, '{}'),
  ('group_lots',    'FPO group-lot pooling',          true, 100, '{}'),
  ('kyc',           'KYC document submission + review', true, 100, '{}'),
  ('product_batches','Regulated-input store inventory batches', true, 100, '{}'),
  ('online_payments','Online payment at checkout (wallet-service) — OFF until payments lands', false, 100, '{}'),
  ('commission_split','Split escrow into seller-net + commission + GST/TDS at settlement — OFF = full release', false, 100, '{}'),
  ('buyer_charges','Apply buyer-side charges (delivery slab + platform fee) at checkout — OFF = none', false, 100, '{}'),
  ('document_pdfs','Render + store statement/invoice PDFs to media — OFF = data only (no S3 write)', false, 100, '{}'),
  ('auctions','English/sealed auctions + bidding (EMD holds) — OFF until launch', false, 100, '{}'),
  ('offers','Buyer-seller price negotiation (offers/counters/accept) — OFF until launch', false, 100, '{}'),
  ('requirements','Reverse marketplace: demand posts + seller quotes — OFF until launch', false, 100, '{}'),
  ('logistics','Shipments + OTP-gated proof-of-delivery — OFF until launch', false, 100, '{}'),
  ('reviews','Verified-purchase ratings + moderation — OFF until launch', false, 100, '{}'),
  ('disputes','Order disputes + evidence + moderator resolution — OFF until launch', false, 100, '{}'),
  ('dispute_refunds','Wallet reversal (escrow → buyer) on a dispute refund — OFF until launch', false, 100, '{}'),
  ('promotions','Promotions + coupon codes (discount engine) — OFF until launch', false, 100, '{}'),
  ('memberships','Subscription tiers + wallet-paid memberships — OFF until launch', false, 100, '{}'),
  ('tenancy','SaaS plans + tenant subscriptions (quota foundation) — OFF until launch', false, 100, '{}'),
  ('labour','Labour bookings + assignments + wage settlement (dignity floor) — OFF until launch', false, 100, '{}'),
  ('livestock','Animal registry + vet marketplace + fee settlement — OFF until launch', false, 100, '{}'),
  ('dairy','Milk procurement: MCC/collections/rate-cards/bills + wallet payout — OFF until launch', false, 100, '{}'),
  ('equipment','Equipment/CHC rental: assets/rates/bookings + escrow settlement — OFF until launch', false, 100, '{}')
ON CONFLICT (key) DO NOTHING;
