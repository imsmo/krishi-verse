-- 0007 · notification event catalog (PRD §14.2) + hi/en/gu templates · [P1]
INSERT INTO notification_events (code,default_name,priority,default_channels,user_can_opt_out,batchable) VALUES
 ('auth.otp','Login OTP','critical','["sms","whatsapp"]',false,false),
 ('order.created','Order placed','important','["push","sms"]',true,false),
 ('order.delivered','Order delivered','important','["push","sms","whatsapp"]',true,false),
 ('payment.success','Payment successful','important','["push","sms"]',true,false),
 ('payout.completed','Payout credited','important','["push","sms"]',true,false),
 ('bid.outbid','You were outbid','important','["push"]',true,false),
 ('bid.won','Auction won','important','["push","sms"]',true,false),
 ('wage.paid','Wage credited','critical','["push","sms"]',true,false),
 ('booking.offer','New work booking offer','important','["push","sms"]',true,false),
 ('scheme.approved','Scheme application approved','important','["push","sms"]',true,false),
 ('price.alert','Mandi price alert','informational','["push"]',true,true),
 ('weather.alert','Weather advisory','important','["push","sms"]',true,false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO notification_templates (event_code,channel,language_code,tenant_id,subject,body,provider_template_ref,is_active) VALUES
 ('auth.otp','sms','hi',NULL,NULL,'Krishi-Verse OTP: {{otp}}. 5 minute me expire. Kisi se share na karein.','DLT_OTP_HI',true),
 ('auth.otp','sms','en',NULL,NULL,'Krishi-Verse OTP: {{otp}}. Expires in 5 min. Do not share.','DLT_OTP_EN',true),
 ('auth.otp','sms','gu',NULL,NULL,'Krishi-Verse OTP: {{otp}}. 5 મિનિટમાં સમાપ્ત. કોઈને શેર ન કરો.','DLT_OTP_GU',true),
 ('wage.paid','sms','hi',NULL,NULL,'{{amount}} aapke khate me jama. Kaam: {{task}}. Krishi-Verse','DLT_WAGE_HI',true),
 ('wage.paid','sms','gu',NULL,NULL,'{{amount}} તમારા ખાતામાં જમા. કામ: {{task}}. Krishi-Verse','DLT_WAGE_GU',true),
 ('order.delivered','push','en',NULL,'Delivered','Your order {{order_no}} was delivered. Rate your experience.',NULL,true)
ON CONFLICT (event_code,channel,language_code,tenant_id) DO NOTHING;
