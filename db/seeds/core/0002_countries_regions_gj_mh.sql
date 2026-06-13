-- 0002 · India + Phase-1 states (Gujarat, Maharashtra) with district samples · [P1]
INSERT INTO countries (code,default_name,currency_code,phone_prefix,timezone,is_active) VALUES
 ('IN','India','INR','+91','Asia/Kolkata',true)
ON CONFLICT (code) DO NOTHING;

-- States
INSERT INTO admin_regions (id,country_code,parent_id,level,code,default_name,path,centroid_lat,centroid_lng,is_active) VALUES
 ('11111111-0000-7000-8000-000000000001','IN',NULL,1,'GJ','Gujarat','in.gj',22.2587,71.1924,true),
 ('11111111-0000-7000-8000-000000000002','IN',NULL,1,'MH','Maharashtra','in.mh',19.7515,75.7139,true)
ON CONFLICT (id) DO NOTHING;

-- Sample districts (Junagadh = founder's base; expand via admin UI later)
INSERT INTO admin_regions (id,country_code,parent_id,level,code,default_name,path,is_active) VALUES
 ('11111111-0000-7000-8000-000000000101','IN','11111111-0000-7000-8000-000000000001',2,'GJ-JUN','Junagadh','in.gj.junagadh',true),
 ('11111111-0000-7000-8000-000000000102','IN','11111111-0000-7000-8000-000000000001',2,'GJ-RAJ','Rajkot','in.gj.rajkot',true),
 ('11111111-0000-7000-8000-000000000201','IN','11111111-0000-7000-8000-000000000002',2,'MH-PUN','Pune','in.mh.pune',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pincodes (country_code,pincode,region_id,lat,lng) VALUES
 ('IN','362001','11111111-0000-7000-8000-000000000101',21.5222,70.4579),
 ('IN','360001','11111111-0000-7000-8000-000000000102',22.3039,70.8022)
ON CONFLICT (country_code,pincode) DO NOTHING;
