-- Enable extensions for scheduled function invocation
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Track per-user scheduler state to avoid duplicate runs
CREATE TABLE public.scheduler_state (
  user_id uuid NOT NULL PRIMARY KEY,
  last_notification_run timestamp with time zone DEFAULT now(),
  last_automation_run timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduler_state ENABLE ROW LEVEL SECURITY;

-- Only the user can read their own state (edge function uses service role)
CREATE POLICY "Users can view own scheduler state"
  ON public.scheduler_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduler state"
  ON public.scheduler_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduler state"
  ON public.scheduler_state FOR UPDATE
  USING (auth.uid() = user_id);
