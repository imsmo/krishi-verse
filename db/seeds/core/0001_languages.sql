-- 0001_languages.sql · platform languages (Phase 1 = 3 active) · [P1]
-- Adding a language later = flip is_active. NO code change, NO migration.
INSERT INTO languages (code,name_native,name_english,script,direction,font_stack,number_format,is_active,voice_stt_ready,sort_order) VALUES
 ('hi','हिन्दी','Hindi','Devanagari','ltr','Noto Sans Devanagari','indian',true,true,1),
 ('en','English','English','Latin','ltr','Inter','indian',true,true,2),
 ('gu','ગુજરાતી','Gujarati','Gujarati','ltr','Noto Sans Gujarati','indian',true,true,3),
 ('mr','मराठी','Marathi','Devanagari','ltr','Noto Sans Devanagari','indian',false,false,4),
 ('ta','தமிழ்','Tamil','Tamil','ltr','Noto Sans Tamil','indian',false,false,5),
 ('te','తెలుగు','Telugu','Telugu','ltr','Noto Sans Telugu','indian',false,false,6),
 ('kn','ಕನ್ನಡ','Kannada','Kannada','ltr','Noto Sans Kannada','indian',false,false,7),
 ('bn','বাংলা','Bengali','Bengali','ltr','Noto Sans Bengali','indian',false,false,8),
 ('pa','ਪੰਜਾਬੀ','Punjabi','Gurmukhi','ltr','Noto Sans Gurmukhi','indian',false,false,9),
 ('or','ଓଡ଼ିଆ','Odia','Odia','ltr','Noto Sans Oriya','indian',false,false,10),
 ('as','অসমীয়া','Assamese','Bengali','ltr','Noto Sans Bengali','indian',false,false,11),
 ('ml','മലയാളം','Malayalam','Malayalam','ltr','Noto Sans Malayalam','indian',false,false,12)
ON CONFLICT (code) DO NOTHING;
