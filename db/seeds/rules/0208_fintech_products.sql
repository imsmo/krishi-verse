-- 0208 · sample lending partner + loan product (GLOBAL reference data, no tenant_id) · [P3]
-- Authored on the platform/partner surface (Law 11). Seeds one NBFC + a crop-loan product so the lending
-- flow is usable out of the box. product_kind_id → 'loan_kind' lookup; partner_id → financial_partners.
INSERT INTO financial_partners (id, code, default_name, partner_kind, regulator_ref, is_active) VALUES
 ('22222222-0000-7000-8000-000000000001','samunnati','Samunnati Financial','nbfc','RBI-NBFC-0001',true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO loan_products (id, partner_id, product_kind_id, default_name, currency_code, min_amount_minor, max_amount_minor, interest_apr_bps, tenure_months_min, tenure_months_max, collateral_kind, repayment_style, is_active)
SELECT '22222222-0000-7000-8000-000000000101', '22222222-0000-7000-8000-000000000001',
       (SELECT id FROM lookup_values WHERE type_code='loan_kind' AND code='crop' AND tenant_id IS NULL),
       'Kharif Crop Loan', 'INR', 1000000, 50000000, 1100, 3, 12, 'none', 'harvest_aligned', true
ON CONFLICT (id) DO NOTHING;
