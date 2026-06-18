-- 0004 · all 24 PRD roles + permission catalog + role→permission grants · [P1]
-- Dynamic RBAC: role #25 or a new permission is an INSERT here, never a deploy.
INSERT INTO roles (code,default_name,scope,requires_kyc,requires_approval,module_code) VALUES
 ('super_admin','Super Admin / SaaS Owner','platform',true,false,NULL),
 ('platform_finance','Platform Finance','platform',true,true,NULL),
 ('platform_support','Platform Support','platform',false,true,NULL),
 ('platform_compliance','Platform Compliance','platform',true,true,NULL),
 ('tenant_admin','Tenant Admin','tenant',true,true,'M01'),
 ('tenant_staff','Tenant Staff','tenant',false,true,'M01'),
 ('customer','Customer','tenant',false,false,'M01'),
 ('farmer','Farmer / Vendor','tenant',true,true,'M03'),
 ('vyapari','Vyapari / Trader','tenant',true,true,'M04'),
 ('pharma_store','Pharma / Agri-Input Store','tenant',true,true,'M10'),
 ('organic_store','Organic Store / Producer','tenant',true,true,'M11'),
 ('delivery_partner','Delivery Partner','tenant',true,true,'M07'),
 ('instructor','Education Instructor','tenant',false,true,'M09'),
 ('support_agent','Support Agent','tenant',false,true,NULL),
 ('auditor','Auditor / Accountant','tenant',false,true,NULL),
 ('ambassador','Village Ambassador','tenant',true,true,NULL),
 ('fpo_coordinator','FPO Coordinator','tenant',true,true,NULL),
 ('ai_ops','AI Operations Officer','tenant',false,true,NULL),
 ('pashupalak','Pashupalak / Livestock Farmer','tenant',true,true,'M15'),
 ('dairy_farmer','Dairy Farmer / MCC Operator','tenant',true,true,'M16'),
 ('vet','Veterinarian / AI Inseminator','tenant',true,true,'M15'),
 ('banker','Banker / NBFC Loan Officer','tenant',true,true,'M19'),
 ('insurance_agent','Insurance Agent / Surveyor','tenant',true,true,'M19'),
 ('equipment_owner','Equipment Owner / CHC Operator','tenant',true,true,'M20'),
 ('gov_officer','Government Officer / Scheme Operator','tenant',true,true,'M17'),
 ('worker','Agricultural Worker','tenant',true,true,'M28'),
 ('sardar','Sardar / Mukadam','tenant',true,true,'M28')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code,default_name,module_code) VALUES
 ('listing.create','Create listing','M03'),('listing.update','Edit listing','M03'),
 ('listing.publish','Publish listing','M03'),('listing.approve','Approve listing','M03'),
 ('listing.moderate','Moderate/hide listing','M03'),
 ('order.create','Place order','M06'),('order.manage','Manage orders','M06'),
 ('offer.create','Make/respond to listing offers','M03'),
 ('requirement.post','Post a requirement (demand)','M12'),('requirement.quote','Quote on a requirement','M12'),
 ('logistics.manage','Manage shipments / dispatch','M07'),
 ('review.create','Write a verified-purchase review','M03'),('review.moderate','Moderate reviews','M03'),
 ('dispute.raise','Raise an order dispute',NULL),
 ('promotion.manage','Manage promotions + coupons','M03'),
 ('auction.bid','Place bid','M04'),('auction.create','Create auction','M04'),
 ('wallet.view','View wallet','M05'),('wallet.adjust','Manual wallet adjust','M05'),
 ('payout.approve','Approve payouts','M05'),
 ('user.approve','Approve users (KYC)','M01'),('user.impersonate','Impersonate user','M01'),
 ('dispute.resolve','Resolve disputes',NULL),('report.view','View reports',NULL),
 ('tenant.settings','Manage tenant settings','M01'),('flag.toggle','Toggle feature flags',NULL),
 ('worker.book','Book worker','M28'),('booking.manage','Manage labour bookings','M28'),
 ('ledger.read','Read ledger (auditor)','M05'),('scheme.process','Process scheme applications','M17'),
 ('ai.review','AI review queue',NULL),('plan.manage','Manage plans (god mode)',NULL),
 ('tenant.manage','Manage tenants (god mode)',NULL),
 ('product.manage','Manage own products + batches','M02'),
 ('catalogue.configure','Enable/disable categories for the tenant','M02')
ON CONFLICT (code) DO NOTHING;

-- grants (sample of the full PRD §10 matrix; complete in admin UI)
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r CROSS JOIN permissions p
WHERE (r.code='farmer'        AND p.code IN ('listing.create','listing.update','listing.publish','order.create','offer.create','requirement.post','auction.bid','wallet.view','worker.book'))
   OR (r.code='vyapari'       AND p.code IN ('order.create','offer.create','requirement.post','auction.bid','auction.create','wallet.view'))
   OR (r.code='tenant_admin'  AND p.code IN ('listing.approve','listing.moderate','order.manage','user.approve','dispute.resolve','report.view','tenant.settings','payout.approve','wallet.adjust','booking.manage','logistics.manage','promotion.manage'))
   OR (r.code='support_agent' AND p.code IN ('dispute.resolve','report.view'))
   OR (r.code='auditor'       AND p.code IN ('ledger.read','report.view'))
   OR (r.code='ai_ops'        AND p.code IN ('ai.review','listing.moderate'))
   OR (r.code='super_admin'   AND p.code IN ('plan.manage','tenant.manage','user.impersonate','flag.toggle'))
   OR (r.code='gov_officer'   AND p.code IN ('scheme.process','report.view'))
   OR (r.code='tenant_admin'  AND p.code IN ('product.manage','catalogue.configure'))
   OR (r.code IN ('farmer','pharma_store','organic_store','vyapari') AND p.code IN ('product.manage','order.manage'))
   OR (r.code IN ('farmer','vyapari','pharma_store','organic_store') AND p.code IN ('requirement.quote'))
   OR (r.code IN ('farmer','vyapari','customer','pharma_store','organic_store') AND p.code IN ('review.create'))
   OR (r.code IN ('tenant_admin','support_agent','ai_ops') AND p.code IN ('review.moderate'))
   OR (r.code IN ('farmer','vyapari','customer','pharma_store','organic_store') AND p.code IN ('dispute.raise'))
   OR (r.code='customer' AND p.code IN ('order.create','offer.create','requirement.post'))
ON CONFLICT DO NOTHING;
