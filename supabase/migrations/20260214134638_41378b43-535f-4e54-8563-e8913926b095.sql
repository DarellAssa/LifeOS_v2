
-- Migrate focus_blocks status values: 'completed' -> 'done', 'skipped' -> 'missed'
UPDATE public.focus_blocks SET status = 'done' WHERE status = 'completed';
UPDATE public.focus_blocks SET status = 'missed' WHERE status = 'skipped';

-- Migrate goals status: 'archived' -> 'paused'
UPDATE public.goals SET status = 'paused' WHERE status = 'archived';
