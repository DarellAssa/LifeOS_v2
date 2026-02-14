import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROUTE_MAP: Record<string, string> = {
  task: "/tasks", goal: "/goals", note: "/notes",
  inbox: "/inbox", event: "/calendar", focus: "/calendar", habit: "/habits",
};

// ── Helpers ──
function toLocalDate(tz: string): string {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    return fmt.format(now); // YYYY-MM-DD
  } catch { return new Date().toISOString().slice(0, 10); }
}

function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    // Service client for data fetching
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get profile
    const { data: profile } = await supa.from("profiles").select("first_name, timezone, week_start, modules").eq("id", userId).single();
    const tz = profile?.timezone || "UTC";
    const localDate = toLocalDate(tz);

    // Check cache
    if (!force) {
      const { data: cached } = await supa.from("daily_briefings")
        .select("content, model, created_at")
        .eq("user_id", userId).eq("briefing_date", localDate).single();
      if (cached) {
        return new Response(JSON.stringify({ ok: true, source: "cache", briefing: cached.content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Fetch today-focused context ──
    const todayStart = `${localDate}T00:00:00`;
    const todayEnd = `${localDate}T23:59:59`;
    const in48h = new Date(new Date(todayStart).getTime() + 48 * 3600000).toISOString().slice(0, 10);

    // Parallel data fetches
    const [
      { data: overdueTasks },
      { data: dueSoonTasks },
      { data: todayEvents },
      { data: todayFocus },
      { data: activeGoals },
      { data: activeHabits },
      { data: unprocessedInbox },
      { data: habitLogs },
    ] = await Promise.all([
      // Overdue tasks
      supa.from("tasks").select("id, title, status, priority, due_date, project")
        .eq("user_id", userId).is("deleted_at", null)
        .in("status", ["todo", "doing"]).lt("due_date", localDate)
        .order("due_date", { ascending: true }).limit(20),
      // Due soon tasks (today + 48h)
      supa.from("tasks").select("id, title, status, priority, due_date, project")
        .eq("user_id", userId).is("deleted_at", null)
        .in("status", ["todo", "doing"]).gte("due_date", localDate).lte("due_date", in48h)
        .order("due_date", { ascending: true }).limit(20),
      // Today events
      supa.from("calendar_events").select("id, title, start_date_time, end_date_time, category")
        .eq("user_id", userId).is("deleted_at", null)
        .gte("start_date_time", todayStart).lte("start_date_time", todayEnd)
        .order("start_date_time", { ascending: true }).limit(10),
      // Today focus blocks
      supa.from("focus_blocks").select("id, title, start_date_time, end_date_time, status")
        .eq("user_id", userId).is("deleted_at", null)
        .gte("start_date_time", todayStart).lte("start_date_time", todayEnd)
        .order("start_date_time", { ascending: true }).limit(10),
      // Active goals
      supa.from("goals").select("id, title, status, category, progress_value, target_date")
        .eq("user_id", userId).is("deleted_at", null).eq("status", "active")
        .order("target_date", { ascending: true }).limit(10),
      // Active habits
      supa.from("habits").select("id, title, frequency, category, status")
        .eq("user_id", userId).is("deleted_at", null).eq("status", "active").limit(10),
      // Unprocessed inbox
      supa.from("inbox_items").select("id, title, content, source")
        .eq("user_id", userId).is("deleted_at", null).eq("status", "unprocessed")
        .order("created_at", { ascending: false }).limit(10),
      // Today's habit logs
      supa.from("habit_logs").select("habit_id")
        .eq("user_id", userId).eq("logged_on", localDate),
    ]);

    // Check if user has meaningful data
    const totalData = (overdueTasks?.length || 0) + (dueSoonTasks?.length || 0) +
      (todayEvents?.length || 0) + (todayFocus?.length || 0) +
      (activeGoals?.length || 0) + (activeHabits?.length || 0) +
      (unprocessedInbox?.length || 0);

    if (totalData === 0) {
      const emptyBriefing = {
        headline: "No data yet — add tasks or events to get your briefing.",
        metrics: { tasks_due_today: 0, tasks_overdue: 0, events_today: 0, focus_minutes_planned_today: 0, inbox_unprocessed: 0, habits_at_risk: 0, goals_at_risk: 0 },
        schedule: [], top_priorities: [], risks: [],
        inbox: { unprocessed_count: 0, suggestion: "Capture your first item to the inbox." },
        next_actions: [],
      };
      return new Response(JSON.stringify({ ok: true, source: "empty", briefing: emptyBriefing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute metrics
    const loggedHabitIds = new Set((habitLogs || []).map((l: any) => l.habit_id));
    const dailyHabits = (activeHabits || []).filter((h: any) => h.frequency === "daily");
    const unloggedDailyHabits = dailyHabits.filter((h: any) => !loggedHabitIds.has(h.id));

    const focusMinutes = (todayFocus || []).reduce((sum: number, fb: any) =>
      sum + minutesBetween(fb.start_date_time, fb.end_date_time), 0);

    const goalsAtRisk = (activeGoals || []).filter((g: any) =>
      g.target_date && g.target_date < localDate && g.progress_value < 100);

    const metrics = {
      tasks_due_today: (dueSoonTasks || []).filter((t: any) => t.due_date === localDate).length,
      tasks_overdue: overdueTasks?.length || 0,
      events_today: todayEvents?.length || 0,
      focus_minutes_planned_today: focusMinutes,
      inbox_unprocessed: unprocessedInbox?.length || 0,
      habits_at_risk: unloggedDailyHabits.length,
      goals_at_risk: goalsAtRisk.length,
    };

    // Build compact context for AI
    const aiContext = {
      user: { first_name: profile?.first_name || "", timezone: tz },
      local_date: localDate,
      metrics,
      schedule: [
        ...(todayEvents || []).map((e: any) => ({ kind: "event", id: e.id, title: e.title, start_at: e.start_date_time, end_at: e.end_date_time, route: "/calendar" })),
        ...(todayFocus || []).map((f: any) => ({ kind: "focus", id: f.id, title: f.title, start_at: f.start_date_time, end_at: f.end_date_time, route: "/calendar" })),
      ].sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 8),
      overdue_tasks: (overdueTasks || []).slice(0, 10).map((t: any) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date, route: "/tasks" })),
      due_soon_tasks: (dueSoonTasks || []).slice(0, 10).map((t: any) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date, route: "/tasks" })),
      active_goals: (activeGoals || []).slice(0, 6).map((g: any) => ({ id: g.id, title: g.title, progress: g.progress_value, target_date: g.target_date, route: "/goals" })),
      habits_unlogged: unloggedDailyHabits.slice(0, 5).map((h: any) => ({ id: h.id, title: h.title, route: "/habits" })),
      inbox_unprocessed_count: unprocessedInbox?.length || 0,
    };

    if (!LOVABLE_API_KEY) {
      // Fallback: metrics-only briefing
      const fallback = buildMetricsOnlyBriefing(metrics, aiContext);
      await upsertBriefing(supa, userId, localDate, fallback, "fallback");
      return new Response(JSON.stringify({ ok: true, source: "fallback", briefing: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Call AI ──
    const modelName = "google/gemini-2.5-flash";
    const systemPrompt = `You are an executive briefing generator for a personal productivity system.
Generate a daily briefing in STRICT JSON format. No markdown, no explanation, ONLY the JSON object.

TONE: Executive. Concise. Numeric. No motivational language. No emojis.
RULES:
- headline: max 70 chars, factual summary of the day
- reasons/why: max 120 chars each
- next_actions: 3-6 items. plan_prompt must be a direct instruction for the AI planner.
- ONLY reference entity IDs present in the context. If unsure, omit.
- top_priorities: max 3 items from overdue or due_soon tasks, prioritize high priority
- risks: max 3 items from overdue tasks, at-risk goals, unlogged habits
- schedule: copy from context, max 5 items

OUTPUT SCHEMA:
{
  "headline": string,
  "metrics": { tasks_due_today, tasks_overdue, events_today, focus_minutes_planned_today, inbox_unprocessed, habits_at_risk, goals_at_risk },
  "schedule": [{ "kind":"event|focus", "id":string, "title":string, "start_at":string, "end_at":string, "route":string }],
  "top_priorities": [{ "id":string, "title":string, "route":string, "reason":string, "priority":"low|med|high", "due_date":string|null }],
  "risks": [{ "type":"task|goal|habit|calendar", "id":string, "title":string, "route":string, "reason":string, "severity":"low|med|high" }],
  "inbox": { "unprocessed_count":number, "suggestion":string },
  "next_actions": [{ "title":string, "why":string, "cta":string, "risk":"low|medium|high", "plan_prompt":string }]
}`;

    let briefingContent: any = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Today's context:\n${JSON.stringify(aiContext)}` },
            ],
            max_tokens: 1500,
            temperature: 0.2,
          }),
        });

        if (!resp.ok) {
          console.error(`AI call failed (attempt ${attempt}): ${resp.status}`);
          continue;
        }

        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { console.error("No JSON in AI output"); continue; }

        const parsed = JSON.parse(jsonMatch[0]);

        // Basic validation
        if (!parsed.headline || !parsed.metrics || !Array.isArray(parsed.next_actions)) {
          console.error("Invalid briefing structure"); continue;
        }

        // Ensure metrics are numbers
        parsed.metrics = {
          tasks_due_today: Number(parsed.metrics.tasks_due_today) || metrics.tasks_due_today,
          tasks_overdue: Number(parsed.metrics.tasks_overdue) || metrics.tasks_overdue,
          events_today: Number(parsed.metrics.events_today) || metrics.events_today,
          focus_minutes_planned_today: Number(parsed.metrics.focus_minutes_planned_today) || metrics.focus_minutes_planned_today,
          inbox_unprocessed: Number(parsed.metrics.inbox_unprocessed) || metrics.inbox_unprocessed,
          habits_at_risk: Number(parsed.metrics.habits_at_risk) || metrics.habits_at_risk,
          goals_at_risk: Number(parsed.metrics.goals_at_risk) || metrics.goals_at_risk,
        };

        // Cap arrays
        parsed.schedule = (parsed.schedule || []).slice(0, 5);
        parsed.top_priorities = (parsed.top_priorities || []).slice(0, 3);
        parsed.risks = (parsed.risks || []).slice(0, 3);
        parsed.next_actions = (parsed.next_actions || []).slice(0, 6);

        // Ensure headline length
        if (parsed.headline.length > 70) parsed.headline = parsed.headline.slice(0, 67) + "...";

        briefingContent = parsed;
        break;
      } catch (e) {
        console.error(`AI parse error (attempt ${attempt}):`, e);
      }
    }

    if (!briefingContent) {
      briefingContent = buildMetricsOnlyBriefing(metrics, aiContext);
    }

    // Upsert
    await upsertBriefing(supa, userId, localDate, briefingContent, modelName);

    // Also upsert next_best_actions
    if (briefingContent.next_actions?.length > 0) {
      await supa.from("next_best_actions").upsert({
        user_id: userId,
        action_date: localDate,
        actions: briefingContent.next_actions,
      }, { onConflict: "user_id,action_date" });
    }

    return new Response(JSON.stringify({ ok: true, source: "fresh", briefing: briefingContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error(`[${requestId}] Briefing error:`, e);
    return new Response(JSON.stringify({ error: "Failed to generate briefing", requestId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function upsertBriefing(supa: any, userId: string, date: string, content: any, model: string) {
  await supa.from("daily_briefings").upsert({
    user_id: userId,
    briefing_date: date,
    content,
    model,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,briefing_date" });
}

function buildMetricsOnlyBriefing(metrics: any, ctx: any): any {
  const parts: string[] = [];
  if (metrics.tasks_overdue > 0) parts.push(`${metrics.tasks_overdue} overdue`);
  if (metrics.tasks_due_today > 0) parts.push(`${metrics.tasks_due_today} due today`);
  if (metrics.events_today > 0) parts.push(`${metrics.events_today} events`);
  const headline = parts.length > 0 ? parts.join(", ") : "Your day at a glance";

  const actions: any[] = [];
  if (metrics.tasks_overdue > 0) {
    actions.push({
      title: "Resolve overdue tasks",
      why: `${metrics.tasks_overdue} tasks past due date`,
      cta: "Review",
      risk: "high",
      plan_prompt: "Review my overdue tasks and help me reschedule or complete them",
    });
  }
  if (metrics.inbox_unprocessed > 0) {
    actions.push({
      title: "Triage inbox",
      why: `${metrics.inbox_unprocessed} unprocessed items`,
      cta: "Triage",
      risk: "medium",
      plan_prompt: "Triage my unprocessed inbox items into tasks or events",
    });
  }
  if (metrics.habits_at_risk > 0) {
    actions.push({
      title: "Log daily habits",
      why: `${metrics.habits_at_risk} habits not logged today`,
      cta: "Log",
      risk: "low",
      plan_prompt: "Show me which daily habits I haven't logged today",
    });
  }

  return {
    headline: headline.slice(0, 70),
    metrics,
    schedule: (ctx.schedule || []).slice(0, 5),
    top_priorities: (ctx.overdue_tasks || []).slice(0, 3).map((t: any) => ({
      id: t.id, title: t.title, route: t.route,
      reason: `Overdue since ${t.due_date}`, priority: t.priority, due_date: t.due_date,
    })),
    risks: [],
    inbox: {
      unprocessed_count: metrics.inbox_unprocessed,
      suggestion: metrics.inbox_unprocessed > 0 ? "Process inbox items to keep it clean." : "Inbox is clear.",
    },
    next_actions: actions.slice(0, 6),
  };
}
