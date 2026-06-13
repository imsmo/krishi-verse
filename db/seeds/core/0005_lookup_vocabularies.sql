-- 0005 · controlled vocabularies (admin-extendable where flagged) · [P1]
INSERT INTO lookup_types (code,default_name,is_tenant_extendable) VALUES
 ('tenant_type','Tenant type',false),('doc_type','Document type',false),
 ('cancel_reason','Order cancel reason',true),('dispute_reason','Dispute reason',false),
 ('cert_type','Certificate type',false),('payment_purpose','Payment purpose',false),
 ('payout_purpose','Payout purpose',false),('ledger_txn_type','Ledger txn type',false),
 ('labour_task','Labour task type',true),('labour_demand_type','Labour demand type',false),
 ('boost_tier','Listing boost tier',false),('address_label','Address label',true),
 ('delivery_method','Delivery method',false),('vehicle_type','Vehicle type',false),
 ('ticket_category','Support ticket category',true),('report_reason','Moderation reason',false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO lookup_values (type_code,tenant_id,code,default_name,meta,sort_order) VALUES
 ('tenant_type',NULL,'fpo','FPO','{}',1),('tenant_type',NULL,'cooperative','Cooperative','{}',2),
 ('tenant_type',NULL,'dairy_union','Dairy Union','{}',3),('tenant_type',NULL,'startup','Agri-Startup','{}',4),
 ('tenant_type',NULL,'government','Government','{}',5),
 ('doc_type',NULL,'aadhaar','Aadhaar','{}',1),('doc_type',NULL,'pan','PAN','{}',2),
 ('doc_type',NULL,'land_record','Land Record','{}',3),('doc_type',NULL,'gst_cert','GST Certificate','{}',4),
 ('dispute_reason',NULL,'not_delivered','Not delivered','{}',1),('dispute_reason',NULL,'poor_quality','Poor quality','{}',2),
 ('dispute_reason',NULL,'qty_mismatch','Quantity mismatch','{}',3),('dispute_reason',NULL,'late','Late delivery','{}',4),
 ('boost_tier',NULL,'local','Local 30km / 3 days','{"price_minor":4900,"days":3}',1),
 ('boost_tier',NULL,'regional','Regional / 7 days','{"price_minor":14900,"days":7}',2),
 ('boost_tier',NULL,'statewide','Statewide / 14 days','{"price_minor":39900,"days":14}',3),
 ('ledger_txn_type',NULL,'order_payment','Order payment','{}',1),('ledger_txn_type',NULL,'escrow_hold','Escrow hold','{}',2),
 ('ledger_txn_type',NULL,'escrow_release','Escrow release','{}',3),('ledger_txn_type',NULL,'commission','Commission','{}',4),
 ('ledger_txn_type',NULL,'wage_payout','Wage payout','{}',5),('ledger_txn_type',NULL,'emd_hold','EMD hold','{}',6),
 ('payment_purpose',NULL,'wallet_recharge','Wallet recharge','{}',1),('payment_purpose',NULL,'direct_order','Direct order','{}',2),
 ('payout_purpose',NULL,'settlement','Seller settlement','{}',1),('payout_purpose',NULL,'wage','Worker wage','{}',2),
 ('delivery_method',NULL,'self_pickup','Self pickup','{}',1),('delivery_method',NULL,'tenant_delivery','Tenant delivery','{}',2)
ON CONFLICT (type_code,tenant_id,code) DO NOTHING;
