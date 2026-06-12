
-- 1. Drop legacy unused tables from starter template
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.records CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP FUNCTION IF EXISTS public.log_changes() CASCADE;

-- 2. Helper to get the caller's office_id without recursive RLS
CREATE OR REPLACE FUNCTION public.current_user_office_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 3. Tighten profiles SELECT
DROP POLICY IF EXISTS "profiles read" ON public.profiles;
CREATE POLICY "profiles read self or privileged"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.is_director_or_supervisor(auth.uid())
);

-- 4. Tighten daily_reports SELECT
DROP POLICY IF EXISTS "daily_reports read" ON public.daily_reports;
CREATE POLICY "daily_reports read scoped"
ON public.daily_reports
FOR SELECT
TO authenticated
USING (
  submitted_by = auth.uid()
  OR public.is_director_or_supervisor(auth.uid())
  OR office_id = public.current_user_office_id()
);

-- 5. Tighten emergencies SELECT
DROP POLICY IF EXISTS "emergencies read" ON public.emergencies;
CREATE POLICY "emergencies read scoped"
ON public.emergencies
FOR SELECT
TO authenticated
USING (
  reported_by = auth.uid()
  OR public.is_director_or_supervisor(auth.uid())
  OR office_id = public.current_user_office_id()
);

-- 6. Tighten agent_locations SELECT
DROP POLICY IF EXISTS "agent_locations read" ON public.agent_locations;
CREATE POLICY "agent_locations read scoped"
ON public.agent_locations
FOR SELECT
TO authenticated
USING (
  agent_id = auth.uid()
  OR public.is_director_or_supervisor(auth.uid())
);

-- 7. Fix mutable search_path on update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
