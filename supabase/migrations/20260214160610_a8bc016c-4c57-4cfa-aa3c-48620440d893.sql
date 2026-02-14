
-- Table to store plan request hashes for approval validation
CREATE TABLE public.copilot_plan_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  request_id text NOT NULL,
  plan_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.copilot_plan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own plan requests"
  ON public.copilot_plan_requests
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_copilot_plan_requests_user_request ON public.copilot_plan_requests (user_id, request_id);

-- Auto-cleanup old requests (older than 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_plan_requests()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.copilot_plan_requests WHERE created_at < now() - interval '24 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_plan_requests_on_insert
  AFTER INSERT ON public.copilot_plan_requests
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_plan_requests();
