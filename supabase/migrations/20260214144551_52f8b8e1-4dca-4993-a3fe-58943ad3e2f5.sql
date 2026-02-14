-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Search index table: denormalized searchable text per entity
CREATE TABLE public.search_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('task','goal','note','inbox','event','focus','habit')),
  entity_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  search_text text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);

-- Enable RLS
ALTER TABLE public.search_index ENABLE ROW LEVEL SECURITY;

-- RLS: users can only access their own search index rows
CREATE POLICY "Users CRUD own search index"
  ON public.search_index
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigram index on search_text for fuzzy matching
CREATE INDEX idx_search_index_trgm ON public.search_index USING gin (search_text gin_trgm_ops);

-- Btree index for filtering
CREATE INDEX idx_search_index_user_type ON public.search_index (user_id, entity_type);

-- Btree index for entity lookups
CREATE INDEX idx_search_index_entity ON public.search_index (entity_id);

-- Function: ranked trigram search with multiple query terms
CREATE OR REPLACE FUNCTION public.search_entities(
  p_user_id uuid,
  p_query text,
  p_types text[] DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  entity_type text,
  entity_id uuid,
  title text,
  snippet text,
  score real,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.entity_type,
    si.entity_id,
    si.title,
    LEFT(si.search_text, 120) AS snippet,
    similarity(si.search_text, p_query)::real AS score,
    si.metadata
  FROM public.search_index si
  WHERE si.user_id = p_user_id
    AND (p_types IS NULL OR si.entity_type = ANY(p_types))
    AND (
      si.search_text % p_query
      OR si.title ILIKE '%' || p_query || '%'
      OR si.search_text ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE WHEN si.title ILIKE p_query THEN 0
         WHEN si.title ILIKE '%' || p_query || '%' THEN 1
         ELSE 2
    END,
    similarity(si.search_text, p_query) DESC
  LIMIT p_limit;
$$;