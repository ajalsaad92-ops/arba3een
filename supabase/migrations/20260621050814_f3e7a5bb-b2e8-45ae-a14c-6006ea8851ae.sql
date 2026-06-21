ALTER TABLE public.report_field_definitions
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS with_quantity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_free_text boolean NOT NULL DEFAULT false;