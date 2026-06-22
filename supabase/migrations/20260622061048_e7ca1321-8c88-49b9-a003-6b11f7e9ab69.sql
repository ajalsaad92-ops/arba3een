-- C1: Replace fragile auth.role()='authenticated' policies with auth.uid()-based ownership rules

-- emergencies INSERT
DROP POLICY IF EXISTS "emergencies insert" ON public.emergencies;
CREATE POLICY "emergencies insert" ON public.emergencies
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      reported_by = auth.uid()
      OR is_director_or_supervisor(auth.uid())
      OR office_id = current_user_office_id()
    )
  );

-- extension_requests INSERT
DROP POLICY IF EXISTS "extension_requests insert" ON public.extension_requests;
CREATE POLICY "extension_requests insert" ON public.extension_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      requested_by = auth.uid()
      OR is_director_or_supervisor(auth.uid())
      OR office_id = current_user_office_id()
    )
  );

-- agent_locations INSERT (upsert)
DROP POLICY IF EXISTS "agent_locations upsert" ON public.agent_locations;
CREATE POLICY "agent_locations upsert" ON public.agent_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      agent_id = auth.uid()
      OR is_director_or_supervisor(auth.uid())
    )
  );

-- Reference/lookup tables SELECT: any authenticated user can read
DROP POLICY IF EXISTS "offices read" ON public.offices;
CREATE POLICY "offices read" ON public.offices
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "time_windows read" ON public.time_windows;
CREATE POLICY "time_windows read" ON public.time_windows
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "border_crossings read" ON public.border_crossings;
CREATE POLICY "border_crossings read" ON public.border_crossings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "flow_paths read" ON public.visitor_flow_paths;
CREATE POLICY "flow_paths read" ON public.visitor_flow_paths
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- C2: Server time RPC (authoritative time for time-window locks)
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT now() $$;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated, anon;

-- C3: Drop duplicate unique index on daily_reports (keep daily_reports_office_id_report_date_key)
DROP INDEX IF EXISTS public.uq_daily_reports_office_date;