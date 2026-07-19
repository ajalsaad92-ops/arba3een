
-- 1. Add is_frozen flag to field definitions
ALTER TABLE public.report_field_definitions
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;

-- 2. Create frozen field change requests table
CREATE TABLE IF NOT EXISTS public.frozen_field_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  field_key text NOT NULL,
  field_label_ar text,
  current_value jsonb,
  requested_value jsonb NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending_supervisor'
    CHECK (status IN ('pending_supervisor','pending_director','approved','rejected')),
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  requested_by_name text,
  supervisor_approved_by uuid REFERENCES public.profiles(id),
  supervisor_approved_at timestamptz,
  director_approved_by uuid REFERENCES public.profiles(id),
  director_approved_at timestamptz,
  rejected_by uuid REFERENCES public.profiles(id),
  rejected_at timestamptz,
  rejection_reason text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ffcr_office ON public.frozen_field_change_requests(office_id);
CREATE INDEX IF NOT EXISTS idx_ffcr_status ON public.frozen_field_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_ffcr_requester ON public.frozen_field_change_requests(requested_by);

GRANT SELECT, INSERT, UPDATE ON public.frozen_field_change_requests TO authenticated;
GRANT ALL ON public.frozen_field_change_requests TO service_role;

ALTER TABLE public.frozen_field_change_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can read their own; supervisors read within permitted offices; directors read all
CREATE POLICY "ffcr_read"
  ON public.frozen_field_change_requests
  FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'supervisor')
  );

-- Any authenticated user in the office can create for their own office
CREATE POLICY "ffcr_insert"
  ON public.frozen_field_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (
      office_id = public.current_user_office_id()
      OR public.is_director_or_supervisor(auth.uid())
    )
  );

-- Supervisors + directors can update (approve / reject / apply)
CREATE POLICY "ffcr_update"
  ON public.frozen_field_change_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_director_or_supervisor(auth.uid()))
  WITH CHECK (public.is_director_or_supervisor(auth.uid()));

CREATE TRIGGER trg_ffcr_updated
  BEFORE UPDATE ON public.frozen_field_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
