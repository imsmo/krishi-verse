-- 0003 · currencies + units of measure with conversions · [P1]
INSERT INTO currencies (code,default_name,symbol,minor_units,is_active) VALUES
 ('INR','Indian Rupee','₹',2,true),
 ('BDT','Bangladeshi Taka','৳',2,false),
 ('USD','US Dollar','$',2,false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO units (code,default_name,unit_class,is_active) VALUES
 ('kg','Kilogram','mass',true),('quintal','Quintal','mass',true),('ton','Tonne','mass',true),
 ('gram','Gram','mass',true),('litre','Litre','volume',true),('ml','Millilitre','volume',true),
 ('piece','Piece','count',true),('dozen','Dozen','count',true),('bag','Bag','count',true),
 ('crate','Crate','count',true),('acre','Acre','area',true),('hectare','Hectare','area',true),
 ('hour','Hour','time',true),('day','Day','time',true),('km','Kilometre','length',true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO unit_conversions (from_unit,to_unit,factor) VALUES
 ('quintal','kg',100),('ton','kg',1000),('kg','gram',1000),('dozen','piece',12),('hectare','acre',2.47105)
ON CONFLICT (from_unit,to_unit) DO NOTHING;
