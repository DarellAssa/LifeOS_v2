import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSearchText(entity: Record<string, any>, type: string): string {
  const parts: string[] = [];
  if (entity.title) parts.push(entity.title);
  if (entity.description) parts.push(entity.description);
  if (entity.content) parts.push(entity.content);
  if (entity.notes) parts.push(entity.notes);
  if (entity.project) parts.push(`project:${entity.project}`);
  if (entity.category) parts.push(`category:${entity.category}`);
  if (entity.priority) parts.push(`priority:${entity.priority}`);
  if (entity.status) parts.push(`status:${entity.status}`);
  if (entity.frequency) parts.push(`frequency:${entity.frequency}`);
  if (entity.due_date) parts.push(`due:${entity.due_date}`);
  if (entity.start_date_time) parts.push(`start:${entity.start_date_time.slice(0, 10)}`);
  if (entity.target_date) parts.push(`target:${entity.target_date}`);
  if (Array.isArray(entity.tags)) parts.push(...entity.tags.map((t: string) => `tag:${t}`));
  return parts.join(" ").slice(0, 2000);
}

function buildMetadata(entity: Record<string, any>, type: string): Record<string, any> {
  const m: Record<string, any> = {};
  if (entity.status) m.status = entity.status;
  if (entity.priority) m.priority = entity.priority;
  if (entity.due_date) m.dueDate = entity.due_date;
  if (entity.category) m.category = entity.category;
  if (entity.project) m.project = entity.project;
  if (entity.start_date_time) m.start = entity.start_date_time;
  if (entity.end_date_time) m.end = entity.end_date_time;
  if (entity.frequency) m.frequency = entity.frequency;
  if (entity.progress_value !== undefined) m.progress = entity.progress_value;
  if (entity.target_date) m.targetDate = entity.target_date;
  return m;
}

interface EntityConfig {
  table: string;
  type: string;
  select: string;
}

const ENTITY_CONFIGS: EntityConfig[] = [
  { table: "tasks", type: "task", select: "id, title, description, status, priority, due_date, tags, project, goal_id" },
  { table: "goals", type: "goal", select: "id, title, description, status, category, progress_value, target_date" },
  { table: "notes", type: "note", select: "id, title, content, tags" },
  { table: "inbox_items", type: "inbox", select: "id, title, content, status, source, tags" },
  { table: "calendar_events", type: "event", select: "id, title, notes, category, start_date_time, end_date_time" },
  { table: "focus_blocks", type: "focus", select: "id, title, notes, status, start_date_time, end_date_time, linked_task_id" },
  { table: "habits", type: "habit", select: "id, title, description, frequency, category, status, target_count_per_period" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const types = body.types as string[] | undefined;
    const configs = types ? ENTITY_CONFIGS.filter(c => types.includes(c.type)) : ENTITY_CONFIGS;

    let totalIndexed = 0;
    const progress: Record<string, number> = {};

    for (const config of configs) {
      const { data: entities, error: fetchErr } = await supabase
        .from(config.table)
        .select(config.select)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(500);

      if (fetchErr || !entities) {
        console.error(`Error fetching ${config.table}:`, fetchErr);
        continue;
      }

      const rows = entities.map((e: any) => ({
        user_id: userId,
        entity_type: config.type,
        entity_id: e.id,
        title: e.title || (e.content || "").slice(0, 80) || "Untitled",
        search_text: buildSearchText(e, config.type),
        metadata: buildMetadata(e, config.type),
        updated_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        // Batch upsert in chunks of 50
        for (let i = 0; i < rows.length; i += 50) {
          const chunk = rows.slice(i, i + 50);
          const { error: upsertErr } = await supabase
            .from("search_index")
            .upsert(chunk, { onConflict: "user_id,entity_type,entity_id" });
          if (upsertErr) console.error(`Upsert error for ${config.type}:`, upsertErr);
        }
      }

      progress[config.type] = rows.length;
      totalIndexed += rows.length;
    }

    // Clean up entries for deleted entities
    // (soft-deleted items won't be in the fetch, so their index entries become stale)
    // We only clean types we just processed
    for (const config of configs) {
      const { data: indexedIds } = await supabase
        .from("search_index")
        .select("entity_id")
        .eq("user_id", userId)
        .eq("entity_type", config.type);

      if (!indexedIds || indexedIds.length === 0) continue;

      const { data: liveEntities } = await supabase
        .from(config.table)
        .select("id")
        .eq("user_id", userId)
        .is("deleted_at", null);

      const liveIds = new Set((liveEntities || []).map((e: any) => e.id));
      const staleIds = indexedIds
        .filter((r: any) => !liveIds.has(r.entity_id))
        .map((r: any) => r.entity_id);

      if (staleIds.length > 0) {
        await supabase
          .from("search_index")
          .delete()
          .eq("user_id", userId)
          .eq("entity_type", config.type)
          .in("entity_id", staleIds);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, totalIndexed, progress }),
      { headers: jsonHeaders }
    );
  } catch (err: any) {
    console.error("search-index error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
