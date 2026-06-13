-- 0204 · delivery slabs, buyer platform fee, EMD · [P1]
INSERT INTO charge_definitions (tenant_id,charge_code,calc_method,config,currency_code,effective_from,is_active) VALUES
 (NULL,'delivery_fee','slab','{"slabs":[{"upto_minor":39900,"fee_minor":3900},{"upto_minor":null,"fee_minor":0}]}','INR',CURRENT_DATE,true),
 (NULL,'buyer_platform_fee','percent','{"bps":250}','INR',CURRENT_DATE,true),
 (NULL,'emd','percent','{"bps":1000,"min_minor":10000}','INR',CURRENT_DATE,true)
ON CONFLICT DO NOTHING;
