-- 0104 · clonable attribute templates (PRD §9.2) · [P1]
INSERT INTO attribute_templates (code,default_name,category_id,payload) VALUES
 ('wheat_standard','Wheat standard',(SELECT id FROM categories WHERE code='crops.cereals.wheat'),'{"attributes":["variety","grade","moisture_pct","harvest_date"]}')
ON CONFLICT (code) DO NOTHING;
