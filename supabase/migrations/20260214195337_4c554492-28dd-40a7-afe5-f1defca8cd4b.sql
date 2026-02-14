
-- Create activity_log table
CREATE TABLE public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('user','copilot','automation','system')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  title text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_activity_log_user_ts ON public.activity_log (user_id, ts DESC);
CREATE INDEX idx_activity_log_user_source_ts ON public.activity_log (user_id, source, ts DESC);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users CRUD own activity logs"
  ON public.activity_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
