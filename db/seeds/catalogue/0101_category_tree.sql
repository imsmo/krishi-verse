-- 0101 · 5-level category tree (ltree) — the "varchar category fix" populated · [P1]
INSERT INTO categories (id,parent_id,code,default_name,path,depth,commerce_kind,requires_license,requires_certificate,is_active,sort_order) VALUES
 ('44444444-0000-7000-8000-000000000001',NULL,'crops','Crops','crops',1,'goods',false,false,true,1),
 ('44444444-0000-7000-8000-000000000002',NULL,'livestock','Livestock','livestock',1,'livestock',false,false,true,2),
 ('44444444-0000-7000-8000-000000000003',NULL,'inputs','Agri Inputs','inputs',1,'input_regulated',true,false,true,3),
 ('44444444-0000-7000-8000-000000000004',NULL,'equipment','Equipment','equipment',1,'rental',false,false,true,4),
 ('44444444-0000-7000-8000-000000000005',NULL,'services','Services','services',1,'service',false,false,true,5),
 -- level 2 under crops
 ('44444444-0000-7000-8000-000000000011','44444444-0000-7000-8000-000000000001','crops.cereals','Cereals','crops.cereals',2,'goods',false,false,true,1),
 ('44444444-0000-7000-8000-000000000012','44444444-0000-7000-8000-000000000001','crops.pulses','Pulses','crops.pulses',2,'goods',false,false,true,2),
 ('44444444-0000-7000-8000-000000000013','44444444-0000-7000-8000-000000000001','crops.oilseeds','Oilseeds','crops.oilseeds',2,'goods',false,false,true,3),
 ('44444444-0000-7000-8000-000000000014','44444444-0000-7000-8000-000000000001','crops.vegetables','Vegetables','crops.vegetables',2,'goods',false,false,true,4),
 ('44444444-0000-7000-8000-000000000015','44444444-0000-7000-8000-000000000001','crops.fruits','Fruits','crops.fruits',2,'goods',false,false,true,5),
 ('44444444-0000-7000-8000-000000000016','44444444-0000-7000-8000-000000000001','crops.spices','Spices','crops.spices',2,'goods',false,false,true,6),
 -- level 3 examples
 ('44444444-0000-7000-8000-000000000111','44444444-0000-7000-8000-000000000011','crops.cereals.wheat','Wheat','crops.cereals.wheat',3,'goods',false,false,true,1),
 ('44444444-0000-7000-8000-000000000112','44444444-0000-7000-8000-000000000013','crops.oilseeds.groundnut','Groundnut','crops.oilseeds.groundnut',3,'goods',false,false,true,1),
 ('44444444-0000-7000-8000-000000000113','44444444-0000-7000-8000-000000000016','crops.spices.cumin','Cumin','crops.spices.cumin',3,'goods',false,false,true,1)
ON CONFLICT (id) DO NOTHING;
