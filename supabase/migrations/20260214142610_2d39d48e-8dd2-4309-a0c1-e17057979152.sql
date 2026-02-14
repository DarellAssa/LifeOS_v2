
-- copilot_threads
CREATE TABLE public.copilot_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.copilot_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own threads" ON public.copilot_threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- copilot_messages
CREATE TABLE public.copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.copilot_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL DEFAULT '',
  tool_name text,
  tool_args jsonb,
  tool_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own messages" ON public.copilot_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- copilot_tool_audit
CREATE TABLE public.copilot_tool_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.copilot_threads(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  tool_args jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL CHECK (outcome IN ('success','failed','blocked','needs_confirmation')),
  error text,
  created_entities jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.copilot_tool_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own audit" ON public.copilot_tool_audit FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_copilot_threads_user ON public.copilot_threads(user_id);
CREATE INDEX idx_copilot_messages_thread ON public.copilot_messages(thread_id);
CREATE INDEX idx_copilot_audit_thread ON public.copilot_tool_audit(thread_id);
CREATE INDEX idx_copilot_audit_user ON public.copilot_tool_audit(user_id);

-- Updated_at trigger for threads
CREATE TRIGGER update_copilot_threads_updated_at
  BEFORE UPDATE ON public.copilot_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
