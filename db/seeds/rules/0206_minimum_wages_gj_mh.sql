-- 0206 · statutory minimum wages — the labour DIGNITY FLOOR (per state x skill) · [P1]
-- These back the chk_dignity_floor CHECK: bookings below this are impossible to insert.
INSERT INTO minimum_wages (region_id,skill_level,daily_wage_minor,hourly_wage_minor,overtime_multiplier,effective_from,source_notification) VALUES
 ('11111111-0000-7000-8000-000000000001','unskilled',38000,4750,1.5,CURRENT_DATE,'GJ Labour Dept (placeholder — verify)'),
 ('11111111-0000-7000-8000-000000000001','semi_skilled',42000,5250,1.5,CURRENT_DATE,'GJ Labour Dept'),
 ('11111111-0000-7000-8000-000000000001','skilled',48000,6000,1.5,CURRENT_DATE,'GJ Labour Dept'),
 ('11111111-0000-7000-8000-000000000002','unskilled',42000,5250,1.5,CURRENT_DATE,'MH Labour Dept (placeholder — verify)'),
 ('11111111-0000-7000-8000-000000000002','semi_skilled',46000,5750,1.5,CURRENT_DATE,'MH Labour Dept'),
 ('11111111-0000-7000-8000-000000000002','skilled',52000,6500,1.5,CURRENT_DATE,'MH Labour Dept')
ON CONFLICT (region_id,skill_level,effective_from) DO NOTHING;
