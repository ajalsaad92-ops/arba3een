-- Make daily_reports write policies robust and ownership-aware.
-- The old INSERT policy relied on auth.role()='authenticated', which is
-- unreliable under the new asymmetric JWT signing keys. The upsert flow
-- (onConflict office_id,report_date) also triggers the UPDATE policy when a
-- report already exists for the same office/day, so that path must allow
-- same-office collaboration in addition to the original submitter and
-- directors/supervisors.

DROP POLICY IF EXISTS "daily_reports insert" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports update" ON public.daily_reports;

CREATE POLICY "daily_reports insert"
ON public.daily_reports
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    submitted_by = auth.uid()
    OR public.is_director_or_supervisor(auth.uid())
    OR office_id = public.current_user_office_id()
  )
);

CREATE POLICY "daily_reports update"
ON public.daily_reports
FOR UPDATE
TO authenticated
USING (
  submitted_by = auth.uid()
  OR public.is_director_or_supervisor(auth.uid())
  OR office_id = public.current_user_office_id()
)
WITH CHECK (
  submitted_by = auth.uid()
  OR public.is_director_or_supervisor(auth.uid())
  OR office_id = public.current_user_office_id()
);