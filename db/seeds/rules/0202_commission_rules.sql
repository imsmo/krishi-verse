-- 0202 · commission rules = Revenue Playbook category table AS DATA (effective-dated) · [P1]
-- rate_bps = tenant commission; platform_share_bps = KV's % OF that commission.
INSERT INTO commission_rules (tenant_id,category_id,source,seller_role_id,rate_bps,fixed_minor,cap_minor,platform_share_bps,charged_to,priority,effective_from,is_active) VALUES
 (NULL,NULL,'direct',NULL,350,0,NULL,1000,'seller',100,CURRENT_DATE,true),     -- crop direct 3.5% / KV 10%
 (NULL,NULL,'auction',NULL,500,0,NULL,1000,'seller',100,CURRENT_DATE,true),    -- crop auction 5.0% / KV 10%
 (NULL,NULL,NULL,(SELECT id FROM roles WHERE code='worker'),150,0,10000,800,'buyer',90,CURRENT_DATE,true) -- labour 1.5% capped ₹100, KV 8%, buyer pays
ON CONFLICT DO NOTHING;
