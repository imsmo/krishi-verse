-- 0008 · tenant setting registry (new setting = INSERT, never a migration) · [P1]
INSERT INTO setting_definitions (key,value_type,default_value,scope,description) VALUES
 ('order.auto_confirm_hours','int','2','tenant','Hours before unconfirmed order auto-cancels'),
 ('order.quality_window_hours','int','24','tenant','Dispute window after delivery (perishable: override 6)'),
 ('listing.approval_required','bool','false','tenant','New listings need admin approval'),
 ('review.enabled','bool','true','tenant','Reviews enabled'),
 ('delivery.free_above_minor','int','39900','tenant','Free delivery threshold (₹399)'),
 ('payout.min_threshold_minor','int','50000','tenant','Minimum payout (₹500)'),
 ('payout.cycle','string','"daily"','tenant','Settlement cycle')
ON CONFLICT (key) DO NOTHING;
