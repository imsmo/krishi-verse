-- 0205 · buyer/consumer membership tiers (sliding platform fee) · [P1]
INSERT INTO membership_tiers (tenant_id,code,default_name,audience_role_id,monthly_fee_minor,annual_fee_minor,currency_code,platform_fee_bps_override,benefits,is_active) VALUES
 (NULL,'household_free','Household Free',(SELECT id FROM roles WHERE code='customer'),0,0,'INR',250,'{}',true),
 (NULL,'household_plus','Household Plus',(SELECT id FROM roles WHERE code='customer'),19900,199000,'INR',200,'{"free_delivery":true}',true),
 (NULL,'household_premium','Household Premium',(SELECT id FROM roles WHERE code='customer'),49900,499000,'INR',150,'{"free_delivery":true,"farm_connect":true}',true),
 (NULL,'business','Business',(SELECT id FROM roles WHERE code='vyapari'),99900,999000,'INR',200,'{"gst_invoice":true,"credit_days":30}',true),
 (NULL,'wholesale','Wholesale/Enterprise',(SELECT id FROM roles WHERE code='vyapari'),299900,2999000,'INR',100,'{"credit_days":60}',true)
ON CONFLICT (tenant_id,code) DO NOTHING;
