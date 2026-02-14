
-- Create daily_briefings table
CREATE TABLE public.daily_briefings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  briefing_date date NOT NULL,
  content jsonb NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique per user per day
ALTER TABLE public.daily_briefings ADD CONSTRAINT daily_briefings_user_date_unique UNIQUE (user_id, briefing_date);

-- Enable RLS
ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own briefings" ON public.daily_briefings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create next_best_actions table
CREATE TABLE public.next_best_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action_date date NOT NULL,
  actions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.next_best_actions ADD CONSTRAINT next_best_actions_user_date_unique UNIQUE (user_id, action_date);

ALTER TABLE public.next_best_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own actions" ON public.next_best_actions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at on daily_briefings
CREATE TRIGGER set_daily_briefings_updated_at
  BEFORE UPDATE ON public.daily_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
