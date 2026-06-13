-- 0207 · ambassador earning streams as data (Ambassador Brochure) · [P1]
INSERT INTO commission_plans_ambassador (tenant_id,event_code,amount_minor,rate_bps,cap_minor,conditions,effective_from,is_active) VALUES
 (NULL,'farmer_onboarded',2500,NULL,NULL,'{}',CURRENT_DATE,true),                          -- ₹25 at KYC
 (NULL,'first_txn_30d',5000,NULL,NULL,'{"within_days":30}',CURRENT_DATE,true),             -- ₹50 if first txn in 30d
 (NULL,'listing_assist',2500,NULL,NULL,'{"max_per_farmer":5}',CURRENT_DATE,true),          -- ₹25, first 5 listings
 (NULL,'first_sale_facilitated',NULL,100,10000,'{"max_sales_per_farmer":5}',CURRENT_DATE,true), -- 1% cap ₹100
 (NULL,'sale_trail',1000,NULL,NULL,'{"after_first_sales":5}',CURRENT_DATE,true),            -- ₹10/sale loyalty trail
 (NULL,'worker_onboarded',10000,NULL,NULL,'{}',CURRENT_DATE,true),                          -- ₹100/worker (Field Ops)
 (NULL,'kcc_facilitated',10000,NULL,NULL,'{}',CURRENT_DATE,true),
 (NULL,'pmsby_enrolled',1000,NULL,NULL,'{}',CURRENT_DATE,true)
ON CONFLICT DO NOTHING;
