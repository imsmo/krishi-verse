-- 0102 · dynamic attribute definitions + options + category bindings · [P1]
INSERT INTO attribute_definitions (id,code,default_name,data_type,unit_code,validation,is_active) VALUES
 ('55555555-0000-7000-8000-000000000001','variety','Variety','option',NULL,'{}',true),
 ('55555555-0000-7000-8000-000000000002','grade','Grade','option',NULL,'{}',true),
 ('55555555-0000-7000-8000-000000000003','moisture_pct','Moisture %','decimal',NULL,'{"min":0,"max":100}',true),
 ('55555555-0000-7000-8000-000000000004','harvest_date','Harvest date','date',NULL,'{}',true),
 ('55555555-0000-7000-8000-000000000005','organic','Organic','bool',NULL,'{}',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO attribute_options (id,attribute_id,code,default_name,sort_order,is_active) VALUES
 ('66666666-0000-7000-8000-000000000001','55555555-0000-7000-8000-000000000002','faq','FAQ',1,true),
 ('66666666-0000-7000-8000-000000000002','55555555-0000-7000-8000-000000000002','premium','Premium',2,true),
 ('66666666-0000-7000-8000-000000000003','55555555-0000-7000-8000-000000000002','grade_a','Grade A',3,true),
 ('66666666-0000-7000-8000-000000000011','55555555-0000-7000-8000-000000000001','hd2967','HD-2967 (wheat)',1,true),
 ('66666666-0000-7000-8000-000000000012','55555555-0000-7000-8000-000000000001','lokwan','Lokwan (wheat)',2,true)
ON CONFLICT (id) DO NOTHING;

-- bind grade+moisture+harvest to all crops (inherits down the tree), variety to wheat
INSERT INTO category_attributes (category_id,attribute_id,is_required,show_in_filters,show_on_card,sort_order) VALUES
 ('44444444-0000-7000-8000-000000000001','55555555-0000-7000-8000-000000000002',true,true,true,1),
 ('44444444-0000-7000-8000-000000000001','55555555-0000-7000-8000-000000000003',false,true,false,2),
 ('44444444-0000-7000-8000-000000000001','55555555-0000-7000-8000-000000000004',false,false,false,3),
 ('44444444-0000-7000-8000-000000000111','55555555-0000-7000-8000-000000000001',false,true,true,1)
ON CONFLICT (category_id,attribute_id) DO NOTHING;
