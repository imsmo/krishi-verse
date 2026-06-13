-- 0103 · launch product master (sample of 30; full set via catalogue admin) · [P1]
INSERT INTO products (id,category_id,code,default_name,default_unit,gst_rate_pct,hsn_code,is_perishable,shelf_life_days,tenant_id,is_active) VALUES
 ('77777777-0000-7000-8000-000000000001','44444444-0000-7000-8000-000000000111','wheat','Wheat','quintal',0,'1001',false,180,NULL,true),
 ('77777777-0000-7000-8000-000000000002','44444444-0000-7000-8000-000000000112','groundnut','Groundnut','quintal',0,'1202',false,120,NULL,true),
 ('77777777-0000-7000-8000-000000000003','44444444-0000-7000-8000-000000000113','cumin','Cumin','quintal',5,'0909',false,365,NULL,true),
 ('77777777-0000-7000-8000-000000000004','44444444-0000-7000-8000-000000000014','tomato','Tomato','kg',0,'0702',true,3,NULL,true),
 ('77777777-0000-7000-8000-000000000005','44444444-0000-7000-8000-000000000014','onion','Onion','quintal',0,'0703',true,30,NULL,true)
ON CONFLICT (id) DO NOTHING;
