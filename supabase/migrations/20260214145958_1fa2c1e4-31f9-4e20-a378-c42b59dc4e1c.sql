
-- ============================================================
-- Auto-index triggers: keep search_index fresh on every write
-- ============================================================

-- Generic function to build search_text for any entity
CREATE OR REPLACE FUNCTION public.build_search_index_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    DELETE FROM public.search_index WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND entity_type = 'task' AND entity_id = COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.search_index WHERE user_id = NEW.user_id AND entity_type = 'task' AND entity_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.search_index (user_id, entity_type, entity_id, title, search_text, metadata, updated_at)
  VALUES (
    NEW.user_id, 'task', NEW.id,
    NEW.title,
    CONCAT_WS(' ', NEW.title, NEW.description, 'status:' || COALESCE(NEW.status,''), 'priority:' || COALESCE(NEW.priority,''), 'due:' || COALESCE(NEW.due_date,''), 'project:' || COALESCE(NEW.project,'')),
    jsonb_build_object('status', NEW.status, 'priority', NEW.priority, 'dueDate', NEW.due_date, 'project', NEW.project),
    now()
  )
  ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, search_text = EXCLUDED.search_text, metadata = EXCLUDED.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_search_index_goal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    DELETE FROM public.search_index WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND entity_type = 'goal' AND entity_id = COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.search_index WHERE user_id = NEW.user_id AND entity_type = 'goal' AND entity_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.search_index (user_id, entity_type, entity_id, title, search_text, metadata, updated_at)
  VALUES (
    NEW.user_id, 'goal', NEW.id,
    NEW.title,
    CONCAT_WS(' ', NEW.title, NEW.description, 'status:' || COALESCE(NEW.status,''), 'category:' || COALESCE(NEW.category,''), 'target:' || COALESCE(NEW.target_date,'')),
    jsonb_build_object('status', NEW.status, 'category', NEW.category, 'progress', NEW.progress_value, 'targetDate', NEW.target_date),
    now()
  )
  ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, search_text = EXCLUDED.search_text, metadata = EXCLUDED.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_search_index_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    DELETE FROM public.search_index WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND entity_type = 'note' AND entity_id = COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.search_index WHERE user_id = NEW.user_id AND entity_type = 'note' AND entity_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.search_index (user_id, entity_type, entity_id, title, search_text, metadata, updated_at)
  VALUES (
    NEW.user_id, 'note', NEW.id,
    NEW.title,
    CONCAT_WS(' ', NEW.title, NEW.content),
    '{}'::jsonb,
    now()
  )
  ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, search_text = EXCLUDED.search_text, metadata = EXCLUDED.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_search_index_inbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    DELETE FROM public.search_index WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND entity_type = 'inbox' AND entity_id = COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.search_index WHERE user_id = NEW.user_id AND entity_type = 'inbox' AND entity_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.search_index (user_id, entity_type, entity_id, title, search_text, metadata, updated_at)
  VALUES (
    NEW.user_id, 'inbox', NEW.id,
    COALESCE(NEW.title, LEFT(NEW.content, 80)),
    CONCAT_WS(' ', COALESCE(NEW.title,''), NEW.content, 'status:' || COALESCE(NEW.status,''), 'source:' || COALESCE(NEW.source,'')),
    jsonb_build_object('status', NEW.status, 'source', NEW.source),
    now()
  )
  ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, search_text = EXCLUDED.search_text, metadata = EXCLUDED.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_search_index_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    DELETE FROM public.search_index WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND entity_type = 'event' AND entity_id = COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.search_index WHERE user_id = NEW.user_id AND entity_type = 'event' AND entity_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.search_index (user_id, entity_type, entity_id, title, search_text, metadata, updated_at)
  VALUES (
    NEW.user_id, 'event', NEW.id,
    NEW.title,
    CONCAT_WS(' ', NEW.title, COALESCE(NEW.notes,''), 'category:' || COALESCE(NEW.category,''), 'start:' || LEFT(NEW.start_date_time,10)),
    jsonb_build_object('category', NEW.category, 'start', NEW.start_date_time, 'end', NEW.end_date_time),
    now()
  )
  ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, search_text = EXCLUDED.search_text, metadata = EXCLUDED.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_search_index_focus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    DELETE FROM public.search_index WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND entity_type = 'focus' AND entity_id = COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.search_index WHERE user_id = NEW.user_id AND entity_type = 'focus' AND entity_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.search_index (user_id, entity_type, entity_id, title, search_text, metadata, updated_at)
  VALUES (
    NEW.user_id, 'focus', NEW.id,
    NEW.title,
    CONCAT_WS(' ', NEW.title, COALESCE(NEW.notes,''), 'status:' || COALESCE(NEW.status,''), 'start:' || LEFT(NEW.start_date_time,10)),
    jsonb_build_object('status', NEW.status, 'start', NEW.start_date_time, 'end', NEW.end_date_time),
    now()
  )
  ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, search_text = EXCLUDED.search_text, metadata = EXCLUDED.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_search_index_habit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    DELETE FROM public.search_index WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND entity_type = 'habit' AND entity_id = COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.search_index WHERE user_id = NEW.user_id AND entity_type = 'habit' AND entity_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.search_index (user_id, entity_type, entity_id, title, search_text, metadata, updated_at)
  VALUES (
    NEW.user_id, 'habit', NEW.id,
    NEW.title,
    CONCAT_WS(' ', NEW.title, COALESCE(NEW.description,''), 'frequency:' || COALESCE(NEW.frequency,''), 'category:' || COALESCE(NEW.category,''), 'status:' || COALESCE(NEW.status,'')),
    jsonb_build_object('frequency', NEW.frequency, 'category', NEW.category, 'status', NEW.status),
    now()
  )
  ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, search_text = EXCLUDED.search_text, metadata = EXCLUDED.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers on all 7 entity tables
CREATE TRIGGER trg_search_index_task AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.build_search_index_task();
CREATE TRIGGER trg_search_index_goal AFTER INSERT OR UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.build_search_index_goal();
CREATE TRIGGER trg_search_index_note AFTER INSERT OR UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.build_search_index_note();
CREATE TRIGGER trg_search_index_inbox AFTER INSERT OR UPDATE ON public.inbox_items FOR EACH ROW EXECUTE FUNCTION public.build_search_index_inbox();
CREATE TRIGGER trg_search_index_event AFTER INSERT OR UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.build_search_index_event();
CREATE TRIGGER trg_search_index_focus AFTER INSERT OR UPDATE ON public.focus_blocks FOR EACH ROW EXECUTE FUNCTION public.build_search_index_focus();
CREATE TRIGGER trg_search_index_habit AFTER INSERT OR UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.build_search_index_habit();

-- Also add DELETE triggers for hard deletes (though the app uses soft deletes)
CREATE OR REPLACE FUNCTION public.delete_search_index_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_type text;
BEGIN
  v_type := CASE TG_TABLE_NAME
    WHEN 'tasks' THEN 'task'
    WHEN 'goals' THEN 'goal'
    WHEN 'notes' THEN 'note'
    WHEN 'inbox_items' THEN 'inbox'
    WHEN 'calendar_events' THEN 'event'
    WHEN 'focus_blocks' THEN 'focus'
    WHEN 'habits' THEN 'habit'
  END;
  DELETE FROM public.search_index WHERE user_id = OLD.user_id AND entity_type = v_type AND entity_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_search_index_task_del AFTER DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.delete_search_index_entry();
CREATE TRIGGER trg_search_index_goal_del AFTER DELETE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.delete_search_index_entry();
CREATE TRIGGER trg_search_index_note_del AFTER DELETE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.delete_search_index_entry();
CREATE TRIGGER trg_search_index_inbox_del AFTER DELETE ON public.inbox_items FOR EACH ROW EXECUTE FUNCTION public.delete_search_index_entry();
CREATE TRIGGER trg_search_index_event_del AFTER DELETE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.delete_search_index_entry();
CREATE TRIGGER trg_search_index_focus_del AFTER DELETE ON public.focus_blocks FOR EACH ROW EXECUTE FUNCTION public.delete_search_index_entry();
CREATE TRIGGER trg_search_index_habit_del AFTER DELETE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.delete_search_index_entry();
