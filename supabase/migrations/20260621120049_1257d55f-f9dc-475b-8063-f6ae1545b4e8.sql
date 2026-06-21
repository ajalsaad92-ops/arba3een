ALTER TABLE public.extension_requests
  ADD COLUMN IF NOT EXISTS target_report_date date,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

-- Backfill: existing open/approved requests target the operational day they were
-- requested (Baghdad = UTC+3).
UPDATE public.extension_requests
SET target_report_date = ((request_time AT TIME ZONE 'Asia/Baghdad')::date)
WHERE target_report_date IS NULL;