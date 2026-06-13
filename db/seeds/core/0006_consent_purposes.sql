-- 0006 · DPDP consent purposes · [P1]
INSERT INTO consent_purposes (code,default_name,is_mandatory,current_version) VALUES
 ('terms','Terms of Service',true,'v1'),('privacy','Privacy Policy',true,'v1'),
 ('marketing','Marketing communications',false,'v1'),('ai_training','AI model training',false,'v1'),
 ('data_sharing','Third-party data sharing',false,'v1'),('location','Location tracking',false,'v1')
ON CONFLICT (code) DO NOTHING;
