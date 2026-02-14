
-- Fix: restrict INSERT to authenticated users or service role
DROP POLICY IF EXISTS "Service can insert job logs" ON public.job_run_logs;

CREATE POLICY "Users can insert own job logs"
  ON public.job_run_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
