-- 0105 · vernacular search aliases (the "tur vs arhar" problem, solved as data) · [P1]
INSERT INTO search_synonyms (term,language_code,entity_type,entity_id,weight,is_active) VALUES
 ('gehu','hi','product','77777777-0000-7000-8000-000000000001',100,true),
 ('ઘઉં','gu','product','77777777-0000-7000-8000-000000000001',100,true),
 ('mungfali','hi','product','77777777-0000-7000-8000-000000000002',100,true),
 ('singdana','gu','product','77777777-0000-7000-8000-000000000002',90,true),
 ('jeera','hi','product','77777777-0000-7000-8000-000000000003',100,true),
 ('jiru','gu','product','77777777-0000-7000-8000-000000000003',100,true)
ON CONFLICT (term,language_code,entity_type,entity_id) DO NOTHING;
