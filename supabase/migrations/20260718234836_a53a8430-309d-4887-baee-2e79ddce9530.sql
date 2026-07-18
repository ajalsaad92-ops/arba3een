
-- 1) إخفاء كل الحقول والمجموعات القديمة (المدمجة والديناميكية)
UPDATE public.report_field_definitions SET is_hidden = true;
UPDATE public.report_field_groups SET is_hidden = true;

-- 2) إنشاء المجموعات الجديدة (PDF)
DO $$
DECLARE
  g_fuel uuid := gen_random_uuid();
  g_coord_main uuid := gen_random_uuid();
  g_coord_service uuid := gen_random_uuid();
  g_coord_medical uuid := gen_random_uuid();
  g_coord_vehicles uuid := gen_random_uuid();
  g_coord_public uuid := gen_random_uuid();
  g_serv_water uuid := gen_random_uuid();
  g_serv_clean uuid := gen_random_uuid();
  g_serv_food uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.report_field_groups (id, title_ar, sort_order, is_hidden) VALUES
    (g_fuel,           'موارد المديرية — الوقود الموزع', 101, false),
    (g_coord_main,     'الجهد التنسيقي — عام',            102, false),
    (g_coord_service,  'الجهد التنسيقي — الخدمية',        103, false),
    (g_coord_medical,  'الجهد التنسيقي — الطبية',         104, false),
    (g_coord_vehicles, 'الجهد التنسيقي — الآليات',        105, false),
    (g_coord_public,   'الجهد التنسيقي — الواصل العام',   106, false),
    (g_serv_water,     'الجهد الخدمي — المياه',           107, false),
    (g_serv_clean,     'الجهد الخدمي — الثلج والتنظيف والإعلام', 108, false),
    (g_serv_food,      'الجهد الخدمي — الطعام والمصادر',  109, false);

  -- 3) إدراج الحقول (كلها ديناميكية رقمية تُحسب في الإحصاء)
  INSERT INTO public.report_field_definitions
    (id, group_id, field_key, label_ar, field_type, sort_order,
     is_hidden, is_built_in, count_in_stats, with_quantity, allow_free_text,
     options, allowed_user_ids, stat_label_ar)
  VALUES
    -- الوقود
    (gen_random_uuid(), g_fuel, 'x_fuel_benzine',   'بنزين',              'number', 1, false, false, true, false, false, '{}', '{}', 'بنزين (لتر)'),
    (gen_random_uuid(), g_fuel, 'x_fuel_diesel',    'زيت الغاز',          'number', 2, false, false, true, false, false, '{}', '{}', 'زيت الغاز (لتر)'),

    -- الجهد التنسيقي عام
    (gen_random_uuid(), g_coord_main, 'x_deployed_staff',  'ملاك منتشر',      'number', 1, false, false, true, false, false, '{}', '{}', 'الملاك المنتشر'),
    (gen_random_uuid(), g_coord_main, 'x_mawakib_general', 'المواكب',         'number', 2, false, false, true, false, false, '{}', '{}', 'المواكب'),
    (gen_random_uuid(), g_coord_main, 'x_mawakib_special', 'المواكب الخاصة',  'number', 3, false, false, true, false, false, '{}', '{}', 'المواكب الخاصة'),

    -- الخدمية
    (gen_random_uuid(), g_coord_service, 'x_gas_cylinders',  'عدد اسطوانات الغاز', 'number', 1, false, false, true, false, false, '{}', '{}', 'اسطوانات الغاز'),
    (gen_random_uuid(), g_coord_service, 'x_kerosene',       'النفط الأبيض',       'number', 2, false, false, true, false, false, '{}', '{}', 'النفط الأبيض'),

    -- الطبية
    (gen_random_uuid(), g_coord_medical, 'x_med_units',      'المفارز الطبية',    'number', 1, false, false, true, false, false, '{}', '{}', 'المفارز الطبية'),
    (gen_random_uuid(), g_coord_medical, 'x_med_staff',      'الكوادر الطبية',    'number', 2, false, false, true, false, false, '{}', '{}', 'الكوادر الطبية'),
    (gen_random_uuid(), g_coord_medical, 'x_ambulances',     'الاسعافات',         'number', 3, false, false, true, false, false, '{}', '{}', 'الإسعافات'),
    (gen_random_uuid(), g_coord_medical, 'x_med_mawakib',    'المواكب الطبية',    'number', 4, false, false, true, false, false, '{}', '{}', 'المواكب الطبية'),

    -- الآليات
    (gen_random_uuid(), g_coord_vehicles, 'x_veh_services',   'عدد الخدمات',            'number', 1, false, false, true, false, false, '{}', '{}', 'خدمات الآليات'),
    (gen_random_uuid(), g_coord_vehicles, 'x_veh_transport',  'حملات نقل',              'number', 2, false, false, true, false, false, '{}', '{}', 'حملات النقل'),
    (gen_random_uuid(), g_coord_vehicles, 'x_veh_visitors',   'نقل الزائرين',           'number', 3, false, false, true, false, false, '{}', '{}', 'نقل الزائرين'),
    (gen_random_uuid(), g_coord_vehicles, 'x_veh_missing',    'الإبلاغ عن المفقودين',  'number', 4, false, false, true, false, false, '{}', '{}', 'بلاغات المفقودين'),

    -- الواصل العام
    (gen_random_uuid(), g_coord_public, 'x_speeding_reports', 'رصد المركبات المسرعة والإبلاغ عنها', 'number', 1, false, false, true, false, false, '{}', '{}', 'بلاغات المركبات المسرعة'),

    -- المياه
    (gen_random_uuid(), g_serv_water, 'x_water_carton',      'ماء — كرتون',            'number', 1, false, false, true, false, false, '{}', '{}', 'كراتين الماء'),
    (gen_random_uuid(), g_serv_water, 'x_water_sit',         'ماء — ست',               'number', 2, false, false, true, false, false, '{}', '{}', 'ست الماء'),
    (gen_random_uuid(), g_serv_water, 'x_water_liter',       'ماء — لتر',              'number', 3, false, false, true, false, false, '{}', '{}', 'لترات الماء'),
    (gen_random_uuid(), g_serv_water, 'x_water_usable',      'ماء صالحة للاستخدام',    'number', 4, false, false, true, false, false, '{}', '{}', 'الماء الصالح للاستخدام'),

    -- الثلج والتنظيف والإعلام
    (gen_random_uuid(), g_serv_clean, 'x_ice_blocks',         'قوالب الثلج',                                'number', 1, false, false, true, false, false, '{}', '{}', 'قوالب الثلج'),
    (gen_random_uuid(), g_serv_clean, 'x_cleaning_volunteers','عدد المتطوعين المشاركين في التنظيف',        'number', 2, false, false, true, false, false, '{}', '{}', 'متطوعو التنظيف'),
    (gen_random_uuid(), g_serv_clean, 'x_relief_campaigns',   'توفيق الحملات الإغاثية والمبادرات',         'number', 3, false, false, true, false, false, '{}', '{}', 'الحملات الإغاثية'),

    -- الطعام
    (gen_random_uuid(), g_serv_food, 'x_meals_main',    'وجبات الطعام الرئيسية',        'number', 1, false, false, true, false, false, '{}', '{}', 'الوجبات الرئيسية'),
    (gen_random_uuid(), g_serv_food, 'x_meals_light',   'وجبات الطعام الخفيفة',         'number', 2, false, false, true, false, false, '{}', '{}', 'الوجبات الخفيفة'),
    (gen_random_uuid(), g_serv_food, 'x_food_fruits',   'فواكه (كرتون) / اكل (12 كغم)', 'number', 3, false, false, true, false, false, '{}', '{}', 'الفواكه/الأكل');
END $$;
