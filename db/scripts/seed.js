// db/scripts/seed.js · runs seed SQL in dependency order · [P1]
// Usage: node db/scripts/seed.js --env dev [--demo]
// Order: core (lang→geo→currency→roles→lookups→consent→notif→settings)
//        → rules (plans→commission→tax→charges→membership→minwage→ambassador→schemes)
//        → catalogue (categories→attributes→crops→templates→synonyms)
//        → demo (ONLY if --demo AND env != production)
const ORDER = [
  'core/0001_languages.sql','core/0002_countries_regions_gj_mh.sql','core/0003_currencies_units.sql',
  'core/0004_roles_permissions.sql','core/0005_lookup_vocabularies.sql','core/0006_consent_purposes.sql',
  'core/0007_notification_events_templates.sql','core/0008_setting_definitions.sql',
  'rules/0201_plans_limits_features.sql','rules/0202_commission_rules.sql','rules/0203_tax_rules_gst_tds.sql',
  'rules/0204_charge_definitions.sql','rules/0205_membership_tiers.sql','rules/0206_minimum_wages_gj_mh.sql',
  'rules/0207_ambassador_commission_plans.sql','rules/0208_schemes_starter_set.sql',
  'catalogue/0101_category_tree.sql','catalogue/0102_attributes_options.sql','catalogue/0103_launch_crops_30.sql',
  'catalogue/0104_attribute_templates.sql','catalogue/0105_search_synonyms.sql',
];
const DEMO = ['demo/0901_demo_tenants.sql','demo/0902_demo_users_listings.sql'];
// TODO: pg client exec each file in a txn; guard DEMO behind env!=production. See README.
module.exports = { ORDER, DEMO };
