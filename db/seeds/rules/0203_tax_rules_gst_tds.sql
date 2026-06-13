-- 0203 · GST + 194-O TDS as data · [P1]
INSERT INTO tax_rules (country_code,tax_code,category_id,hsn_prefix,rate_bps,threshold_minor,split,effective_from,is_active) VALUES
 ('IN','gst',NULL,NULL,500,NULL,'{"cgst":250,"sgst":250}',CURRENT_DATE,true),
 ('IN','tds_194o',NULL,NULL,100,500000,'{}',CURRENT_DATE,true)
ON CONFLICT DO NOTHING;
