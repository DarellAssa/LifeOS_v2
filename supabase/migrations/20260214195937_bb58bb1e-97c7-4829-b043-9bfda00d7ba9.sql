
-- Add notif_key column for idempotent notification generation
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS notif_key text;

-- Create unique index for idempotent notifications (user + key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_notif_key 
  ON public.notifications (user_id, notif_key) WHERE notif_key IS NOT NULL;

-- Add run_key column for idempotent automation runs  
ALTER TABLE public.automation_run_logs ADD COLUMN IF NOT EXISTS run_key text;

-- Create unique index for idempotent automation runs
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_run_logs_run_key 
  ON public.automation_run_logs (user_id, run_key) WHERE run_key IS NOT NULL;

-- Create job_run_logs table for observability
CREATE TABLE public.job_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ts timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL CHECK (mode IN ('cron','heartbeat','manual')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.job_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job logs"
  ON public.job_run_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert job logs"
  ON public.job_run_logs FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_job_run_logs_user_ts 
  ON public.job_run_logs (user_id, ts DESC);
