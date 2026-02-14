import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are LifeOS Copilot — a concise, accurate personal productivity assistant.

RULES:
1. Use ONLY the data provided in the memory pack and tool outputs. Never fabricate data.
2. If you cannot find information, say: "I don't see that in your data yet."
3. For ambiguous requests, ask a clarifying question instead of guessing.
4. Keep responses short and actionable.
5. When suggesting plans or bulk actions, describe what you'll do and ask "Shall I proceed?" before executing.
6. For single safe actions the user explicitly requested (e.g., "create a task called X"), execute immediately.
7. After executing actions, briefly confirm what was done.
8. When answering questions, cite the specific data (e.g., "You have 3 overdue tasks: ...").
9. Never reveal system internals or the memory pack structure.
10. Use markdown formatting for readability.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_lifeos",
      description: "Search the user's LifeOS data. Use this to find tasks, goals, events, habits, inbox items, notes, etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          types: {
            type: "array",
            items: { type: "string", enum: ["tasks", "goals", "events", "focusBlocks", "habits", "inbox", "notes"] },
            description: "Which data types to search",
          },
          limit: { type: "number", description: "Max results per type" },
          filters: {
            type: "object",
            description: "Optional filters like status, priority",
            properties: {
              status: { type: "string" },
              priority: { type: "string" },
            },
          },
        },
        required: ["query", "types"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task in LifeOS.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "med", "high"] },
          dueDate: { type: "string", description: "YYYY-MM-DD" },
          tags: { type: "array", items: { type: "string" } },
          project: { type: "string" },
          estimatedMinutes: { type: "number" },
          goalId: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update an existing task.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          patch: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["low", "med", "high"] },
              status: { type: "string", enum: ["todo", "doing", "done"] },
              dueDate: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["id", "patch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_task_focus_block",
      description: "Schedule a focus block for a task. If startTime is omitted, uses next free window.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          startTime: { type: "string", description: "HH:MM (optional)" },
          durationMinutes: { type: "number" },
        },
        required: ["taskId", "date", "durationMinutes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Create a calendar event.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          startDateTime: { type: "string", description: "ISO datetime" },
          endDateTime: { type: "string", description: "ISO datetime" },
          category: { type: "string", enum: ["work", "personal", "study", "health", "custom"] },
          notes: { type: "string" },
        },
        required: ["title", "startDateTime", "endDateTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_goal",
      description: "Create a new goal.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: ["health", "career", "finance", "study", "personal", "custom"] },
          startDate: { type: "string", description: "YYYY-MM-DD" },
          targetDate: { type: "string", description: "YYYY-MM-DD" },
          progressType: { type: "string", enum: ["manual", "linked"] },
        },
        required: ["title", "startDate", "targetDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "triage_inbox",
      description: "Convert inbox items into tasks, events, goals, habits, or notes. REQUIRES user confirmation before execution.",
      parameters: {
        type: "object",
        properties: {
          inboxIds: { type: "array", items: { type: "string" } },
          convertTo: { type: "string", enum: ["task", "event", "goal", "habit", "note"] },
          defaults: { type: "object", description: "Default fields for the created entities" },
        },
        required: ["inboxIds", "convertTo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_template",
      description: "Apply a template to create entities. REQUIRES user confirmation before execution.",
      parameters: {
        type: "object",
        properties: {
          templateId: { type: "string" },
          runDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["templateId", "runDate"],
      },
    },
  },
];

// Tools that require user confirmation before execution
const DESTRUCTIVE_TOOLS = new Set(["triage_inbox", "apply_template"]);

// Rate limiting
const requestLog: { ts: number }[] = [];
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  while (requestLog.length > 0 && requestLog[0].ts < windowStart) requestLog.shift();
  if (requestLog.length >= MAX_REQUESTS_PER_MINUTE) return false;
  requestLog.push({ ts: now });
  return true;
}

// ── Server-side tool execution ──

interface ToolExecResult {
  output: Record<string, unknown>;
  actionsTaken: string[];
  dataUsed: string[];
}

async function executeSearch(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  args: { query?: string; types?: string[]; limit?: number; filters?: { status?: string; priority?: string } }
): Promise<ToolExecResult> {
  const query = (args.query || "").toLowerCase();
  const types = args.types || [];
  const limit = args.limit || 10;
  const filters = args.filters || {};
  const results: Record<string, unknown>[] = [];
  const dataUsed: string[] = [];

  const today = new Date().toISOString().slice(0, 10);

  if (types.includes("tasks")) {
    let q = supabase.from("tasks").select("id, title, description, status, priority, due_date, tags, project, goal_id")
      .eq("user_id", userId).is("deleted_at", null);
    if (filters.status === "overdue") {
      q = q.neq("status", "done").lt("due_date", today).not("due_date", "is", null);
    } else if (filters.status) {
      q = q.eq("status", filters.status);
    }
    if (filters.priority) q = q.eq("priority", filters.priority);
    if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    q = q.limit(limit);
    const { data } = await q;
    if (data) {
      results.push(...data.map((t: any) => ({
        kind: "task", id: t.id, title: t.title,
        summary: `Status: ${t.status}, Priority: ${t.priority}, Due: ${t.due_date || "none"}`,
        metadata: { status: t.status, priority: t.priority, dueDate: t.due_date, tags: t.tags, project: t.project },
      })));
      dataUsed.push(`${data.length} tasks`);
    }
  }

  if (types.includes("goals")) {
    let q = supabase.from("goals").select("id, title, status, category, progress_value, target_date")
      .eq("user_id", userId).is("deleted_at", null);
    if (query) q = q.ilike("title", `%${query}%`);
    q = q.limit(limit);
    const { data } = await q;
    if (data) {
      results.push(...data.map((g: any) => ({
        kind: "goal", id: g.id, title: g.title,
        summary: `Status: ${g.status}, Category: ${g.category}, Progress: ${g.progress_value}%, Target: ${g.target_date}`,
        metadata: { status: g.status, category: g.category, progressValue: g.progress_value, targetDate: g.target_date },
      })));
      dataUsed.push(`${data.length} goals`);
    }
  }

  if (types.includes("events")) {
    let q = supabase.from("calendar_events").select("id, title, start_date_time, end_date_time, category")
      .eq("user_id", userId).is("deleted_at", null);
    if (query) q = q.ilike("title", `%${query}%`);
    q = q.limit(limit);
    const { data } = await q;
    if (data) {
      results.push(...data.map((e: any) => ({
        kind: "event", id: e.id, title: e.title,
        summary: `${e.start_date_time} - ${e.end_date_time} (${e.category})`,
        metadata: { startDateTime: e.start_date_time, endDateTime: e.end_date_time, category: e.category },
      })));
      dataUsed.push(`${data.length} events`);
    }
  }

  if (types.includes("habits")) {
    let q = supabase.from("habits").select("id, title, frequency, target_count_per_period, category, status")
      .eq("user_id", userId).is("deleted_at", null);
    if (query) q = q.ilike("title", `%${query}%`);
    q = q.limit(limit);
    const { data } = await q;
    if (data) {
      results.push(...data.map((h: any) => ({
        kind: "habit", id: h.id, title: h.title,
        summary: `${h.frequency}, Target: ${h.target_count_per_period}/period, Category: ${h.category}`,
        metadata: { frequency: h.frequency, category: h.category, status: h.status },
      })));
      dataUsed.push(`${data.length} habits`);
    }
  }

  if (types.includes("inbox")) {
    let q = supabase.from("inbox_items").select("id, title, content, status, source, tags, detected")
      .eq("user_id", userId).is("deleted_at", null);
    if (query) q = q.or(`content.ilike.%${query}%,title.ilike.%${query}%`);
    q = q.limit(limit);
    const { data } = await q;
    if (data) {
      results.push(...data.map((i: any) => ({
        kind: "inbox", id: i.id, title: i.title || (i.content || "").slice(0, 60),
        summary: `Status: ${i.status}, Source: ${i.source}`,
        metadata: { status: i.status, tags: i.tags, detected: i.detected },
      })));
      dataUsed.push(`${data.length} inbox items`);
    }
  }

  if (types.includes("notes")) {
    let q = supabase.from("notes").select("id, title, content, tags, pinned")
      .eq("user_id", userId).is("deleted_at", null);
    if (query) q = q.or(`title.ilike.%${query}%,content.ilike.%${query}%`);
    q = q.limit(limit);
    const { data } = await q;
    if (data) {
      results.push(...data.map((n: any) => ({
        kind: "note", id: n.id, title: n.title,
        summary: (n.content || "").slice(0, 100),
        metadata: { tags: n.tags, pinned: n.pinned },
      })));
      dataUsed.push(`${data.length} notes`);
    }
  }

  if (types.includes("focusBlocks")) {
    let q = supabase.from("focus_blocks").select("id, title, start_date_time, end_date_time, status, linked_task_id")
      .eq("user_id", userId).is("deleted_at", null);
    if (query) q = q.ilike("title", `%${query}%`);
    q = q.limit(limit);
    const { data } = await q;
    if (data) {
      results.push(...data.map((fb: any) => ({
        kind: "focusBlock", id: fb.id, title: fb.title,
        summary: `${fb.start_date_time} (${fb.status})`,
        metadata: { status: fb.status, linkedTaskId: fb.linked_task_id },
      })));
      dataUsed.push(`${data.length} focus blocks`);
    }
  }

  return { output: { results }, actionsTaken: [], dataUsed };
}

async function executeCreateTask(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  args: { title: string; description?: string; priority?: string; dueDate?: string; tags?: string[]; project?: string; estimatedMinutes?: number; goalId?: string }
): Promise<ToolExecResult> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("tasks").insert({
    user_id: userId,
    title: args.title,
    description: args.description || null,
    priority: args.priority || "med",
    due_date: args.dueDate || null,
    tags: args.tags || [],
    project: args.project || null,
    estimated_minutes: args.estimatedMinutes || null,
    goal_id: args.goalId || null,
    status: "todo",
    subtasks: [],
    source: "copilot",
    created_at: now,
    updated_at: now,
  }).select("id").single();

  if (error) return { output: { error: error.message }, actionsTaken: [], dataUsed: [] };
  return { output: { id: data.id }, actionsTaken: [`Created task "${args.title}"`], dataUsed: [] };
}

async function executeUpdateTask(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  args: { id: string; patch: Record<string, unknown> }
): Promise<ToolExecResult> {
  const patch: Record<string, unknown> = {};
  if (args.patch.title !== undefined) patch.title = args.patch.title;
  if (args.patch.description !== undefined) patch.description = args.patch.description;
  if (args.patch.priority !== undefined) patch.priority = args.patch.priority;
  if (args.patch.status !== undefined) {
    patch.status = args.patch.status;
    if (args.patch.status === "done") patch.completed_at = new Date().toISOString();
    else patch.completed_at = null;
  }
  if (args.patch.dueDate !== undefined) patch.due_date = args.patch.dueDate;
  if (args.patch.tags !== undefined) patch.tags = args.patch.tags;
  patch.updated_at = new Date().toISOString();

  const { error } = await supabase.from("tasks").update(patch).eq("id", args.id).eq("user_id", userId);
  if (error) return { output: { error: error.message }, actionsTaken: [], dataUsed: [] };
  return { output: { ok: true }, actionsTaken: [`Updated task ${args.id}`], dataUsed: [] };
}

async function executeScheduleFocusBlock(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  args: { taskId: string; date: string; startTime?: string; durationMinutes: number }
): Promise<ToolExecResult> {
  // Get task
  const { data: task } = await supabase.from("tasks").select("id, title").eq("id", args.taskId).eq("user_id", userId).single();
  if (!task) return { output: { error: "Task not found" }, actionsTaken: [], dataUsed: [] };

  let startDT: Date;
  if (args.startTime) {
    const [h, m] = args.startTime.split(":").map(Number);
    startDT = new Date(args.date);
    startDT.setHours(h, m, 0, 0);
  } else {
    // Find next free window
    const { data: events } = await supabase.from("calendar_events")
      .select("start_date_time, end_date_time")
      .eq("user_id", userId).is("deleted_at", null)
      .gte("start_date_time", args.date + "T00:00:00")
      .lte("start_date_time", args.date + "T23:59:59");
    const { data: blocks } = await supabase.from("focus_blocks")
      .select("start_date_time, end_date_time")
      .eq("user_id", userId).is("deleted_at", null)
      .gte("start_date_time", args.date + "T00:00:00")
      .lte("start_date_time", args.date + "T23:59:59");

    const allItems = [
      ...(events || []).map((e: any) => ({ start: new Date(e.start_date_time), end: new Date(e.end_date_time) })),
      ...(blocks || []).map((b: any) => ({ start: new Date(b.start_date_time), end: new Date(b.end_date_time) })),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());

    const day = new Date(args.date);
    let cursor = new Date(day); cursor.setHours(8, 0, 0, 0);
    const endOfDay = new Date(day); endOfDay.setHours(20, 0, 0, 0);

    startDT = cursor;
    for (const item of allItems) {
      if (new Date(cursor.getTime() + args.durationMinutes * 60000) <= item.start) { startDT = cursor; break; }
      cursor = item.end > cursor ? item.end : cursor;
    }
    if (new Date(cursor.getTime() + args.durationMinutes * 60000) <= endOfDay) startDT = cursor;
    else { startDT = new Date(day); startDT.setHours(9, 0, 0, 0); }
  }

  const endDT = new Date(startDT.getTime() + args.durationMinutes * 60000);
  const now = new Date().toISOString();

  const { error } = await supabase.from("focus_blocks").insert({
    user_id: userId,
    title: task.title,
    start_date_time: startDT.toISOString(),
    end_date_time: endDT.toISOString(),
    linked_task_id: args.taskId,
    status: "planned",
    created_at: now,
    updated_at: now,
  });

  if (error) return { output: { error: error.message }, actionsTaken: [], dataUsed: [] };

  // Update task schedule
  await supabase.from("tasks").update({
    scheduled_start: startDT.toISOString(),
    scheduled_end: endDT.toISOString(),
    updated_at: now,
  }).eq("id", args.taskId).eq("user_id", userId);

  return {
    output: { scheduledStart: startDT.toISOString(), scheduledEnd: endDT.toISOString() },
    actionsTaken: [`Scheduled focus block for "${task.title}" at ${startDT.toISOString().slice(11, 16)}-${endDT.toISOString().slice(11, 16)}`],
    dataUsed: [],
  };
}

async function executeCreateEvent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  args: { title: string; startDateTime: string; endDateTime: string; category?: string; notes?: string }
): Promise<ToolExecResult> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("calendar_events").insert({
    user_id: userId,
    title: args.title,
    start_date_time: args.startDateTime,
    end_date_time: args.endDateTime,
    category: args.category || "personal",
    notes: args.notes || null,
    created_at: now,
    updated_at: now,
  }).select("id").single();

  if (error) return { output: { error: error.message }, actionsTaken: [], dataUsed: [] };
  return { output: { id: data.id }, actionsTaken: [`Created event "${args.title}"`], dataUsed: [] };
}

async function executeCreateGoal(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  args: { title: string; description?: string; category?: string; startDate: string; targetDate: string; progressType?: string }
): Promise<ToolExecResult> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("goals").insert({
    user_id: userId,
    title: args.title,
    description: args.description || null,
    category: args.category || "custom",
    status: "active",
    start_date: args.startDate,
    target_date: args.targetDate,
    progress_type: args.progressType || "manual",
    progress_value: 0,
    linked_task_ids: [],
    milestones: [],
    created_at: now,
    updated_at: now,
  }).select("id").single();

  if (error) return { output: { error: error.message }, actionsTaken: [], dataUsed: [] };
  return { output: { id: data.id }, actionsTaken: [`Created goal "${args.title}"`], dataUsed: [] };
}

async function executeTriageInbox(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  args: { inboxIds: string[]; convertTo: string; defaults?: Record<string, unknown> }
): Promise<ToolExecResult> {
  const now = new Date().toISOString();
  const converted: { inboxId: string; kind: string; entityId: string }[] = [];

  for (const inboxId of args.inboxIds || []) {
    const { data: item } = await supabase.from("inbox_items").select("*").eq("id", inboxId).eq("user_id", userId).single();
    if (!item) continue;

    let entityId = "";
    const defaults = args.defaults || {};

    switch (args.convertTo) {
      case "task": {
        const { data } = await supabase.from("tasks").insert({
          user_id: userId, title: item.title || item.content.slice(0, 100),
          status: "todo", priority: (defaults.priority as string) || "med",
          tags: [], subtasks: [], source: "inbox",
          created_at: now, updated_at: now, ...defaults,
        }).select("id").single();
        entityId = data?.id || "";
        break;
      }
      case "event": {
        const { data } = await supabase.from("calendar_events").insert({
          user_id: userId, title: item.title || item.content.slice(0, 100),
          start_date_time: (defaults.startDateTime as string) || now,
          end_date_time: (defaults.endDateTime as string) || new Date(Date.now() + 3600000).toISOString(),
          category: "personal", created_at: now, updated_at: now, ...defaults,
        }).select("id").single();
        entityId = data?.id || "";
        break;
      }
      case "goal": {
        const today = now.slice(0, 10);
        const { data } = await supabase.from("goals").insert({
          user_id: userId, title: item.title || item.content.slice(0, 100),
          status: "active", category: "custom", start_date: today,
          target_date: (defaults.targetDate as string) || today,
          progress_type: "manual", progress_value: 0,
          linked_task_ids: [], milestones: [],
          created_at: now, updated_at: now, ...defaults,
        }).select("id").single();
        entityId = data?.id || "";
        break;
      }
      case "note": {
        const { data } = await supabase.from("notes").insert({
          user_id: userId, title: item.title || item.content.slice(0, 60),
          content: item.content, tags: [], pinned: false,
          created_at: now, updated_at: now, ...defaults,
        }).select("id").single();
        entityId = data?.id || "";
        break;
      }
    }

    // Mark inbox item as converted
    if (entityId) {
      await supabase.from("inbox_items").update({
        status: "converted",
        conversion: { kind: args.convertTo, entityId, convertedAt: now },
        updated_at: now,
      }).eq("id", inboxId).eq("user_id", userId);
      converted.push({ inboxId, kind: args.convertTo, entityId });
    }
  }

  return {
    output: { converted },
    actionsTaken: [`Converted ${converted.length} inbox items to ${args.convertTo}s`],
    dataUsed: [],
  };
}

async function executeApplyTemplate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  args: { templateId: string; runDate: string }
): Promise<ToolExecResult> {
  const { data: template } = await supabase.from("templates").select("*")
    .eq("id", args.templateId).is("deleted_at", null).single();
  if (!template) return { output: { error: "Template not found" }, actionsTaken: [], dataUsed: [] };

  // Check ownership or built-in
  if (!template.is_built_in && template.user_id !== userId) {
    return { output: { error: "Access denied" }, actionsTaken: [], dataUsed: [] };
  }

  const now = new Date().toISOString();
  const items = (template.items || []) as any[];
  const summary: Record<string, number> = {};

  for (const item of items) {
    switch (item.type) {
      case "task": {
        await supabase.from("tasks").insert({
          user_id: userId, title: item.title || "Untitled Task",
          description: item.description || null, status: "todo",
          priority: item.priority || "med", tags: item.tags || [],
          subtasks: [], source: "template",
          created_at: now, updated_at: now,
        });
        summary.tasks = (summary.tasks || 0) + 1;
        break;
      }
      case "event": {
        const startDT = `${args.runDate}T${item.startTime || "09:00"}:00`;
        const endDT = `${args.runDate}T${item.endTime || "10:00"}:00`;
        await supabase.from("calendar_events").insert({
          user_id: userId, title: item.title || "Untitled Event",
          start_date_time: startDT, end_date_time: endDT,
          category: item.category || "personal",
          created_at: now, updated_at: now,
        });
        summary.events = (summary.events || 0) + 1;
        break;
      }
      case "focusBlock": {
        const startDT = `${args.runDate}T${item.startTime || "09:00"}:00`;
        const endDT = `${args.runDate}T${item.endTime || "10:00"}:00`;
        await supabase.from("focus_blocks").insert({
          user_id: userId, title: item.title || "Focus Block",
          start_date_time: startDT, end_date_time: endDT,
          status: "planned", created_at: now, updated_at: now,
        });
        summary.focusBlocks = (summary.focusBlocks || 0) + 1;
        break;
      }
      case "habit": {
        await supabase.from("habits").insert({
          user_id: userId, title: item.title || "Untitled Habit",
          frequency: item.frequency || "daily", target_count_per_period: 1,
          category: "personal", status: "active", logs: [],
          created_at: now, updated_at: now,
        });
        summary.habits = (summary.habits || 0) + 1;
        break;
      }
    }
  }

  return {
    output: { created: summary },
    actionsTaken: [`Applied template "${template.name}": created ${Object.entries(summary).map(([k, v]) => `${v} ${k}`).join(", ")}`],
    dataUsed: [],
  };
}

// Main tool dispatcher
async function executeTool(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolExecResult> {
  switch (toolName) {
    case "search_lifeos": return await executeSearch(supabase, userId, args as any);
    case "create_task": return await executeCreateTask(supabase, userId, args as any);
    case "update_task": return await executeUpdateTask(supabase, userId, args as any);
    case "schedule_task_focus_block": return await executeScheduleFocusBlock(supabase, userId, args as any);
    case "create_event": return await executeCreateEvent(supabase, userId, args as any);
    case "create_goal": return await executeCreateGoal(supabase, userId, args as any);
    case "triage_inbox": return await executeTriageInbox(supabase, userId, args as any);
    case "apply_template": return await executeApplyTemplate(supabase, userId, args as any);
    default: return { output: { error: `Unknown tool: ${toolName}` }, actionsTaken: [], dataUsed: [] };
  }
}

// Call AI (non-streaming) for tool loop rounds
async function callAINonStreaming(apiKey: string, messages: any[], tools: any[]): Promise<any> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, tools, max_tokens: 2048 }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI error ${resp.status}: ${text}`);
  }
  return await resp.json();
}

// Call AI (streaming) for final response
async function callAIStreaming(apiKey: string, messages: any[], tools: any[]): Promise<Response> {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, tools, stream: true, max_tokens: 2048 }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!checkRateLimit()) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { messages, memoryPack, confirmedActionId, confirmedToolCalls } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // If this is a confirmation execution
    if (confirmedActionId && confirmedToolCalls) {
      const allActions: string[] = [];
      for (const tc of confirmedToolCalls) {
        const args = typeof tc.arguments === "string" ? JSON.parse(tc.arguments) : tc.arguments;
        const result = await executeTool(supabase, userId, tc.name, args);
        allActions.push(...result.actionsTaken);
      }
      return new Response(
        JSON.stringify({ type: "confirmation_executed", actionsTaken: allActions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages for AI
    const aiMessages: any[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n## Current LifeOS Memory Pack\n${memoryPack || "No data available."}` },
      ...messages,
    ];

    // Multi-turn tool loop (max 5 rounds)
    let maxRounds = 5;
    let allActionsTaken: string[] = [];
    let allDataUsed: string[] = [];

    while (maxRounds > 0) {
      maxRounds--;

      // On last round or first attempt, try streaming for final response
      // For intermediate rounds, use non-streaming
      const isLastRound = maxRounds === 0;

      if (isLastRound) {
        // Stream the final response
        const streamResp = await callAIStreaming(LOVABLE_API_KEY, aiMessages, TOOLS);
        if (!streamResp.ok) {
          const status = streamResp.status;
          const text = await streamResp.text();
          if (status === 429) return new Response(JSON.stringify({ error: "AI rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Prepend metadata + proxy stream
        const metadata = JSON.stringify({ actionsTaken: allActionsTaken, dataUsed: allDataUsed });
        const metaEvent = `data: ${JSON.stringify({ copilot_metadata: { actionsTaken: allActionsTaken, dataUsed: allDataUsed } })}\n\n`;

        const encoder = new TextEncoder();
        const metaBytes = encoder.encode(metaEvent);

        const readable = new ReadableStream({
          async start(controller) {
            controller.enqueue(metaBytes);
            const reader = streamResp.body!.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          },
        });

        return new Response(readable, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Non-streaming round for tool execution
      const aiResp = await callAINonStreaming(LOVABLE_API_KEY, aiMessages, TOOLS);
      const choice = aiResp.choices?.[0];
      if (!choice) break;

      const msg = choice.message;
      aiMessages.push(msg);

      // Check for tool calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Check if any are destructive
        const destructiveCalls = msg.tool_calls.filter((tc: any) => DESTRUCTIVE_TOOLS.has(tc.function.name));

        if (destructiveCalls.length > 0) {
          // Return confirmation request to client
          const pendingActions = destructiveCalls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
            description: describeAction(tc.function.name, JSON.parse(tc.function.arguments)),
          }));

          // Execute non-destructive tools
          const safeCalls = msg.tool_calls.filter((tc: any) => !DESTRUCTIVE_TOOLS.has(tc.function.name));
          for (const tc of safeCalls) {
            const args = JSON.parse(tc.function.arguments);
            const result = await executeTool(supabase, userId, tc.function.name, args);
            allActionsTaken.push(...result.actionsTaken);
            allDataUsed.push(...result.dataUsed);
          }

          return new Response(
            JSON.stringify({
              type: "confirmation_required",
              actionId: crypto.randomUUID(),
              pendingActions,
              message: msg.content || "",
              actionsTaken: allActionsTaken,
              dataUsed: allDataUsed,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Execute all safe tool calls
        for (const tc of msg.tool_calls) {
          const args = JSON.parse(tc.function.arguments);
          const result = await executeTool(supabase, userId, tc.function.name, args);
          allActionsTaken.push(...result.actionsTaken);
          allDataUsed.push(...result.dataUsed);
          aiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result.output),
          });
        }
        // Continue loop for AI to respond with the tool results
        continue;
      }

      // No tool calls — stream this final response
      // Re-call with streaming since we already have the full response
      // Just return the content directly
      const finalContent = msg.content || "";
      const responsePayload = {
        type: "final",
        content: finalContent,
        actionsTaken: allActionsTaken,
        dataUsed: allDataUsed,
      };
      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback
    return new Response(
      JSON.stringify({ type: "final", content: "I wasn't able to complete that request. Please try again.", actionsTaken: allActionsTaken, dataUsed: allDataUsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("copilot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function describeAction(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "triage_inbox": {
      const ids = args.inboxIds as string[];
      return `Convert ${ids?.length || 0} inbox item(s) to ${args.convertTo}(s)`;
    }
    case "apply_template":
      return `Apply template to create entities for ${args.runDate}`;
    default:
      return `Execute ${toolName}`;
  }
}
