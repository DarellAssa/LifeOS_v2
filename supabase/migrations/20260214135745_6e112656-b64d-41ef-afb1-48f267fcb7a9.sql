
-- Migrate existing habits.logs JSONB arrays into habit_logs table
-- For each habit with a non-empty logs array, insert one row per date
INSERT INTO public.habit_logs (user_id, habit_id, logged_on, count)
SELECT
  h.user_id,
  h.id,
  (log_date::text)::date,
  1
FROM public.habits h,
  jsonb_array_elements_text(COALESCE(h.logs, '[]'::jsonb)) AS log_date
WHERE h.deleted_at IS NULL
  AND h.logs IS NOT NULL
  AND jsonb_array_length(h.logs) > 0
ON CONFLICT DO NOTHING;

-- Add unique constraint if not exists (for upsert support)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'habit_logs_user_habit_date_unique'
  ) THEN
    ALTER TABLE public.habit_logs
      ADD CONSTRAINT habit_logs_user_habit_date_unique UNIQUE (user_id, habit_id, logged_on);
  END IF;
END $$;
