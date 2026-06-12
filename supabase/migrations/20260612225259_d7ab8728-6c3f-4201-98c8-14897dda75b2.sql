DO $$
DECLARE
  g_deploy uuid; g_coord uuid; g_inc uuid; g_viol uuid; g_death uuid; g_res uuid;
  g_evt uuid; g_vis uuid; g_flow uuid; g_veh uuid; g_proc uuid; g_other uuid;
BEGIN
  IF (SELECT count(*) FROM public.report_field_groups) > 0 THEN
    RAISE NOTICE 'report_field_groups already seeded, skipping';
    RETURN;
  END IF;

  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('الانتشار', 1) RETURNING id INTO g_deploy;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('التنسيق والتعاون', 2) RETURNING id INTO g_coord;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('الإبلاغ عن الحالات المشبوهة والحوادث', 3) RETURNING id INTO g_inc;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('الخروقات الأمنية والثقافية', 4) RETURNING id INTO g_viol;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('الوفيات ضمن حدودكم', 5) RETURNING id INTO g_death;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('توزيع الموارد', 6) RETURNING id INTO g_res;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('الفعاليات', 7) RETURNING id INTO g_evt;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('الزيارات', 8) RETURNING id INTO g_vis;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('حركة الزائرين والقطوعات', 9) RETURNING id INTO g_flow;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('حركة العجلات', 10) RETURNING id INTO g_veh;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('حركات المواكب', 11) RETURNING id INTO g_proc;
  INSERT INTO public.report_field_groups (title_ar, sort_order) VALUES ('ملاحظات أخرى', 12) RETURNING id INTO g_other;

  INSERT INTO public.report_field_definitions (group_id, field_key, label_ar, field_type, sort_order, is_built_in, count_in_stats, stat_label_ar) VALUES
    (g_deploy, 'deploymentCount',       'عدد عناصر الانتشار',          'number',    1, true, true,  'إجمالي عناصر الانتشار'),
    (g_deploy, 'deploymentLocations',   'مواقع الانتشار',               'textarea',  2, true, false, NULL),
    (g_deploy, 'deploymentFormations',  'التشكيلات والمهام',            'textarea',  3, true, false, NULL),
    (g_coord,  'coordinationSectors',   'القطاعات والعمليات المشتركة',  'textarea',  1, true, false, NULL),
    (g_coord,  'coordinationJointOps',  'تفاصيل التنسيق مع الجهات',     'textarea',  2, true, false, NULL),
    (g_inc,    'incidentsCount',        'عدد البلاغات',                 'number',    1, true, true,  'البلاغات والحوادث'),
    (g_inc,    'incidentsDetails',      'التفاصيل والجهد الاستخباري',   'textarea',  2, true, false, NULL),
    (g_viol,   'violationsCount',       'عدد الخروقات',                 'number',    1, true, true,  'الخروقات الأمنية'),
    (g_viol,   'violationsArea',        'المنطقة',                       'text',      2, true, false, NULL),
    (g_viol,   'violationsTimeDetail',  'التوقيت (مثال 14:30)',          'text',      3, true, false, NULL),
    (g_viol,   'violationsDetails',     'التفاصيل',                      'textarea',  4, true, false, NULL),
    (g_death,  'deathsCount',           'عدد الوفيات',                   'number',    1, true, true,  'الوفيات'),
    (g_death,  'deathsLocationMgrs',    'الموقع (MGRS)',                 'text',      2, true, false, NULL),
    (g_death,  'deathsActionTaken',     'الإجراء المتخذ',                'textarea',  3, true, false, NULL),
    (g_res,    'resourcesDistributed',  'كمية الموارد الموزعة',           'number',    1, true, true,  'الموارد الموزعة'),
    (g_res,    'resourcesDetails',      'نوع وتفاصيل الموارد',           'textarea',  2, true, false, NULL),
    (g_evt,    'eventsCount',           'عدد الفعاليات',                 'number',    1, true, true,  'الفعاليات'),
    (g_evt,    'eventsDetails',         'التفاصيل والمستهدفون',          'textarea',  2, true, false, NULL),
    (g_evt,    'eventsLocation',        'موقع الفعالية (تثبيت على الخريطة)', 'location', 3, true, false, NULL),
    (g_vis,    'visitsCount',           'عدد الزيارات',                  'number',    1, true, true,  'الزيارات'),
    (g_vis,    'visitsSummary',         'ملخص مختصر',                    'textarea',  2, true, false, NULL),
    (g_flow,   'visitorsIn',            'الوافدون (داخلون)',             'number',    1, true, true,  'إجمالي الوافدين'),
    (g_flow,   'visitorsOut',           'المغادرون (خارجون)',            'number',    2, true, true,  'إجمالي المغادرين'),
    (g_flow,   'visitorsRoutes',        'محاور السير والقطوعات',          'route',     3, true, false, NULL),
    (g_veh,    'vehiclesCount',         'عدد الآليات الإجمالي',          'number',    1, true, true,  'العجلات'),
    (g_veh,    'vehiclesDetails',       'التفاصيل والنوع والمهمة',       'textarea',  2, true, false, NULL),
    (g_proc,   'processionsCount',      'عدد المواكب',                   'number',    1, true, true,  'المواكب'),
    (g_proc,   'processionsDetails',    'المسارات والخدمات',             'textarea',  2, true, false, NULL),
    (g_proc,   'processionRoute',       'مسار الموكب (على الشوارع)',     'route',     3, true, false, NULL),
    (g_other,  'otherNotes',            'أي تحديثات خدمية أو لوجستية إضافية', 'textarea', 1, true, false, NULL);
END $$;