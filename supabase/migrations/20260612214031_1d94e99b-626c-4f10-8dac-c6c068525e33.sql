-- ════════════════════════════════════════════════════════
-- Dynamic report field definitions (Phase 1)
-- Lets director/supervisor rename, hide, add, restrict, and
-- change the type of report fields without code changes.
-- ════════════════════════════════════════════════════════

CREATE TYPE public.report_field_type AS ENUM (
  'number',
  'text',
  'textarea',
  'location',         -- single point picked on the map
  'multi_location',   -- multiple points
  'route',            -- routed path along streets (Google Routes)
  'date',
  'time'
);

CREATE TABLE public.report_field_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar      text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  is_hidden     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.report_field_definitions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid NOT NULL REFERENCES public.report_field_groups(id) ON DELETE CASCADE,
  field_key           text NOT NULL UNIQUE,    -- machine key used in daily_reports.extra_fields jsonb
  label_ar            text NOT NULL,
  description_ar      text,                    -- helper / examples / instructions
  placeholder_ar      text,
  field_type          public.report_field_type NOT NULL DEFAULT 'text',
  sort_order          integer NOT NULL DEFAULT 0,
  max_length          integer,
  is_hidden           boolean NOT NULL DEFAULT false,
  is_built_in         boolean NOT NULL DEFAULT false, -- true = legacy column in daily_reports; false = extra_fields jsonb
  count_in_stats      boolean NOT NULL DEFAULT false, -- numeric fields that should aggregate in dashboard
  stat_label_ar       text,                    -- optional override label for stats
  allowed_user_ids    uuid[] NOT NULL DEFAULT '{}', -- empty = visible to all
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfd_group ON public.report_field_definitions(group_id);
CREATE INDEX idx_rfd_sort  ON public.report_field_definitions(sort_order);

-- Add jsonb bag on daily_reports for newly added dynamic fields.
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS extra_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── GRANTS ──────────────────────────────────────────────
GRANT SELECT ON public.report_field_groups       TO authenticated;
GRANT SELECT ON public.report_field_definitions  TO authenticated;
GRANT ALL    ON public.report_field_groups       TO service_role;
GRANT ALL    ON public.report_field_definitions  TO service_role;

ALTER TABLE public.report_field_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_field_definitions  ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read definitions (form rendering needs them).
CREATE POLICY "rfg_read_all"  ON public.report_field_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rfd_read_all"  ON public.report_field_definitions
  FOR SELECT TO authenticated USING (true);

-- Only directors/supervisors can manage definitions.
CREATE POLICY "rfg_admin_write" ON public.report_field_groups
  FOR ALL TO authenticated
  USING (public.is_director_or_supervisor(auth.uid()))
  WITH CHECK (public.is_director_or_supervisor(auth.uid()));

CREATE POLICY "rfd_admin_write" ON public.report_field_definitions
  FOR ALL TO authenticated
  USING (public.is_director_or_supervisor(auth.uid()))
  WITH CHECK (public.is_director_or_supervisor(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_rfg_updated
  BEFORE UPDATE ON public.report_field_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rfd_updated
  BEFORE UPDATE ON public.report_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Seed with existing 12 groups / built-in fields ──────
DO $$
DECLARE
  g_deploy uuid; g_coord uuid; g_inc uuid; g_viol uuid; g_death uuid; g_res uuid;
  g_evt uuid; g_vis uuid; g_flow uuid; g_veh uuid; g_proc uuid; g_other uuid;
BEGIN
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
