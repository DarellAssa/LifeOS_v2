
-- =============================================
-- PHASE C: Production Schema Hardening
-- Additive migration: no renames, no drops
-- =============================================

-- 1) ADD SOFT-DELETE + MISSING COLUMNS TO EXISTING TABLES
-- =============================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS linked_task_id uuid;

ALTER TABLE public.focus_blocks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

ALTER TABLE public.inbox_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS route text;


-- 2) CREATE habit_logs TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  logged_on date NOT NULL,
  count int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, habit_id, logged_on)
);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own habit_logs"
  ON public.habit_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 3) INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON public.tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_goal ON public.tasks (user_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON public.goals (user_id, status);
CREATE INDEX IF NOT EXISTS idx_cal_user_start ON public.calendar_events (user_id, start_date_time);
CREATE INDEX IF NOT EXISTS idx_focus_user_start ON public.focus_blocks (user_id, start_date_time);
CREATE INDEX IF NOT EXISTS idx_inbox_user_status ON public.inbox_items (user_id, status);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON public.habit_logs (user_id, logged_on);
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON public.notifications (user_id, created_at DESC);


-- 4) REUSABLE set_updated_at() TRIGGER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'profiles','tasks','goals','calendar_events','focus_blocks',
      'habits','inbox_items','notes','templates','automation_rules'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I; CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;


-- 5) UPDATE TEMPLATES RLS (allow SELECT on built-in)
-- =============================================

DROP POLICY IF EXISTS "Users CRUD own templates" ON public.templates;

CREATE POLICY "Users can view own or built-in templates"
  ON public.templates
  FOR SELECT
  USING (is_built_in = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON public.templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (is_built_in IS NULL OR is_built_in = false));

CREATE POLICY "Users can update own templates"
  ON public.templates
  FOR UPDATE
  USING (auth.uid() = user_id AND (is_built_in IS NULL OR is_built_in = false));

CREATE POLICY "Users can delete own templates"
  ON public.templates
  FOR DELETE
  USING (auth.uid() = user_id AND (is_built_in IS NULL OR is_built_in = false));
