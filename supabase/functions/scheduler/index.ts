import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use service role to iterate all users
function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const nowISO = now.toISOString();

    // Get all users with profiles (active users)
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id");

    if (profileErr || !profiles) {
      console.error("Failed to fetch profiles:", profileErr);
      return new Response(JSON.stringify({ error: "Failed to fetch profiles" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalNotifications = 0;
    let totalAutomationRuns = 0;
    let usersProcessed = 0;

    for (const profile of profiles) {
      const userId = profile.id;

      // Get or create scheduler state
      let { data: state } = await supabase
        .from("scheduler_state")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!state) {
        await supabase.from("scheduler_state").insert({ user_id: userId });
        state = { user_id: userId, last_notification_run: nowISO, last_automation_run: nowISO };
      }

      // Skip if ran less than 4 minutes ago (cron runs every 5 min)
      const lastNotifRun = new Date(state.last_notification_run || 0);
      const lastAutoRun = new Date(state.last_automation_run || 0);
      const minInterval = 4 * 60 * 1000; // 4 minutes

      // ── Notification Generation ──
      if (now.getTime() - lastNotifRun.getTime() >= minInterval) {
        const notifCount = await generateNotificationsForUser(supabase, userId, todayStr, now);
        totalNotifications += notifCount;
        await supabase.from("scheduler_state").update({ last_notification_run: nowISO }).eq("user_id", userId);
      }

      // ── Automation Time Triggers ──
      if (now.getTime() - lastAutoRun.getTime() >= minInterval) {
        const autoCount = await runTimeAutomationsForUser(supabase, userId, todayStr, now);
        totalAutomationRuns += autoCount;
        await supabase.from("scheduler_state").update({ last_automation_run: nowISO }).eq("user_id", userId);
      }

      usersProcessed++;
    }

    return new Response(
      JSON.stringify({ ok: true, usersProcessed, totalNotifications, totalAutomationRuns }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scheduler error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Notification Generation ──
async function generateNotificationsForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  todayStr: string,
  now: Date
): Promise<number> {
  // Get user's notification settings
  let { data: settings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("id", userId)
    .single();

  if (!settings) {
    settings = {
      enabled_types: {
        task_overdue: true, task_due_soon: true, goal_behind: true,
        goal_overdue: true, event_upcoming: true, focus_missed: true,
        habit_missed: true, checkin_missing: true, weekly_review_missing: true,
        inbox_unprocessed: true,
      },
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      due_soon_days: 2,
      event_upcoming_minutes: 60,
      max_notifications_per_day: 12,
    };
  }

  const enabledTypes = settings.enabled_types as Record<string, boolean>;

  // Check quiet hours
  if (settings.quiet_hours_enabled) {
    const hhmm = now.toISOString().slice(11, 16);
    const { quiet_hours_start: start, quiet_hours_end: end } = settings;
    if (start <= end ? (hhmm >= start && hhmm < end) : (hhmm >= start || hhmm < end)) {
      return 0;
    }
  }

  // Get existing notifications today for dedup fingerprinting
  const { data: existingNotifs } = await supabase
    .from("notifications")
    .select("type, entity_ref, created_at, dismissed_at, snoozed_until")
    .eq("user_id", userId)
    .gte("created_at", todayStr + "T00:00:00Z");

  const fingerprints = new Set<string>();
  (existingNotifs || []).forEach((n: any) => {
    if (n.dismissed_at) return;
    if (n.snoozed_until && n.snoozed_until > now.toISOString()) return;
    const ref = n.entity_ref || {};
    fingerprints.add(`${n.type}:${ref.kind || ""}:${ref.id || ""}:${todayStr}`);
  });

  // Count today's notifications for budget
  const todayCount = (existingNotifs || []).length;
  let budget = Math.max(0, (settings.max_notifications_per_day || 12) - todayCount);

  const newNotifs: any[] = [];

  function tryAdd(notif: any) {
    if (budget <= 0) return;
    const ref = notif.entity_ref || {};
    const fp = `${notif.type}:${ref.kind || ""}:${ref.id || ""}:${todayStr}`;
    if (fingerprints.has(fp)) return;
    fingerprints.add(fp);
    budget--;
    newNotifs.push({
      ...notif,
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: now.toISOString(),
    });
  }

  // 1) Overdue tasks
  if (enabledTypes.task_overdue) {
    const { data: overdueTasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, priority")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("status", "in", '("done","canceled")')
      .lt("due_date", todayStr)
      .not("due_date", "is", null);

    if (overdueTasks && overdueTasks.length > 5) {
      tryAdd({
        type: "task_overdue", title: `You have ${overdueTasks.length} overdue tasks`,
        message: `${overdueTasks.length} tasks are past their due date. Review and reschedule them.`,
        severity: "critical",
        entity_ref: { kind: "task", id: "summary" },
        action: { label: "View overdue", route: "/tasks" },
      });
    } else if (overdueTasks) {
      for (const t of overdueTasks) {
        const daysOver = Math.floor((now.getTime() - new Date(t.due_date).getTime()) / 86400000);
        tryAdd({
          type: "task_overdue", title: `"${t.title}" is overdue`,
          message: `This task was due ${t.due_date}${daysOver > 1 ? ` (${daysOver} days ago)` : ""}.`,
          severity: daysOver >= 7 || t.priority === "high" ? "critical" : "warning",
          entity_ref: { kind: "task", id: t.id },
          action: { label: "Fix", route: "/tasks" },
        });
      }
    }
  }

  // 2) Due soon tasks
  if (enabledTypes.task_due_soon) {
    const dueSoonDays = settings.due_soon_days || 2;
    const dueSoonEnd = new Date(now.getTime() + dueSoonDays * 86400000).toISOString().slice(0, 10);
    const { data: dueSoon } = await supabase
      .from("tasks")
      .select("id, title, due_date, priority")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("status", "in", '("done","canceled")')
      .gt("due_date", todayStr)
      .lte("due_date", dueSoonEnd);

    if (dueSoon) {
      for (const t of dueSoon) {
        tryAdd({
          type: "task_due_soon", title: `"${t.title}" due soon`,
          message: `Due ${t.due_date}.`,
          severity: t.priority === "high" ? "warning" : "info",
          entity_ref: { kind: "task", id: t.id },
          action: { label: "View", route: "/tasks" },
        });
      }
    }
  }

  // 3) Goals behind/overdue
  if (enabledTypes.goal_behind || enabledTypes.goal_overdue) {
    const { data: activeGoals } = await supabase
      .from("goals")
      .select("id, title, status, target_date, progress_value, start_date, linked_task_ids")
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (activeGoals) {
      for (const g of activeGoals) {
        const isOverdue = g.target_date < todayStr;
        if (isOverdue && enabledTypes.goal_overdue) {
          tryAdd({
            type: "goal_overdue", title: `"${g.title}" is overdue`,
            message: `Target date ${g.target_date} has passed.`,
            severity: "critical",
            entity_ref: { kind: "goal", id: g.id },
            action: { label: "View", route: "/goals" },
          });
        } else if (!isOverdue && enabledTypes.goal_behind) {
          // Simple behind check: expected progress vs actual
          const totalDays = Math.max(1, (new Date(g.target_date).getTime() - new Date(g.start_date).getTime()) / 86400000);
          const elapsed = Math.max(0, (now.getTime() - new Date(g.start_date).getTime()) / 86400000);
          const expectedProgress = Math.min(100, (elapsed / totalDays) * 100);
          if (g.progress_value < expectedProgress - 15) {
            tryAdd({
              type: "goal_behind", title: `"${g.title}" is behind`,
              message: "Progress is lagging behind the timeline.",
              severity: "warning",
              entity_ref: { kind: "goal", id: g.id },
              action: { label: "View", route: "/goals" },
            });
          }
        }
      }
    }
  }

  // 4) Upcoming events
  if (enabledTypes.event_upcoming) {
    const upcomingMinutes = settings.event_upcoming_minutes || 60;
    const windowEnd = new Date(now.getTime() + upcomingMinutes * 60000).toISOString();
    const { data: events } = await supabase
      .from("calendar_events")
      .select("id, title, start_date_time, location")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gt("start_date_time", now.toISOString())
      .lte("start_date_time", windowEnd);

    if (events) {
      for (const e of events) {
        tryAdd({
          type: "event_upcoming", title: `"${e.title}" starts soon`,
          message: `Starts at ${e.start_date_time.slice(11, 16)}${e.location ? ` at ${e.location}` : ""}.`,
          severity: "info",
          entity_ref: { kind: "event", id: e.id },
          action: { label: "View", route: "/calendar" },
        });
      }
    }
  }

  // 5) Missed focus blocks
  if (enabledTypes.focus_missed) {
    const { data: missedBlocks } = await supabase
      .from("focus_blocks")
      .select("id, title, start_date_time, end_date_time")
      .eq("user_id", userId)
      .eq("status", "planned")
      .is("deleted_at", null)
      .lt("end_date_time", now.toISOString())
      .gte("start_date_time", todayStr + "T00:00:00Z");

    if (missedBlocks) {
      for (const fb of missedBlocks) {
        tryAdd({
          type: "focus_missed", title: `Focus block "${fb.title}" was missed`,
          message: `Planned ${fb.start_date_time.slice(11, 16)} – ${fb.end_date_time.slice(11, 16)}.`,
          severity: "warning",
          entity_ref: { kind: "focusBlock", id: fb.id },
          action: { label: "View", route: "/calendar" },
        });
      }
    }
  }

  // 6) Missed habits (after 18:00)
  if (enabledTypes.habit_missed && now.getHours() >= 18) {
    const { data: activeHabits } = await supabase
      .from("habits")
      .select("id, title, frequency, target_count_per_period")
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (activeHabits) {
      const dailyHabits = activeHabits.filter((h: any) => h.frequency === "daily");
      // Check which have logs today
      const habitIds = dailyHabits.map((h: any) => h.id);
      if (habitIds.length > 0) {
        const { data: todayLogs } = await supabase
          .from("habit_logs")
          .select("habit_id")
          .eq("user_id", userId)
          .eq("logged_on", todayStr)
          .in("habit_id", habitIds);

        const loggedIds = new Set((todayLogs || []).map((l: any) => l.habit_id));
        const missed = dailyHabits.filter((h: any) => !loggedIds.has(h.id));

        if (missed.length > 5) {
          tryAdd({
            type: "habit_missed", title: `${missed.length} habits not logged today`,
            message: "Log your habits before the day ends.",
            severity: "warning",
            entity_ref: { kind: "habit", id: "summary" },
            action: { label: "Log", route: "/habits" },
          });
        } else {
          for (const h of missed) {
            tryAdd({
              type: "habit_missed", title: `"${h.title}" not logged today`,
              message: "Don't break your streak!",
              severity: "warning",
              entity_ref: { kind: "habit", id: h.id },
              action: { label: "Log", route: "/habits" },
            });
          }
        }
      }
    }
  }

  // 7) Missing daily check-in (after 20:00)
  if (enabledTypes.checkin_missing && now.getHours() >= 20) {
    const { data: checkins } = await supabase
      .from("daily_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .limit(1);

    if (!checkins || checkins.length === 0) {
      tryAdd({
        type: "checkin_missing", title: "Daily check-in not done",
        message: "Take 2 minutes to reflect on your day.",
        severity: "info",
        entity_ref: { kind: "checkin", id: todayStr },
        action: { label: "Check in", route: "/" },
      });
    }
  }

  // 8) Inbox unprocessed
  if (enabledTypes.inbox_unprocessed !== false) {
    const { count } = await supabase
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "unprocessed")
      .is("deleted_at", null);

    if (count && count >= 5) {
      tryAdd({
        type: "inbox_unprocessed", title: `${count} inbox items need processing`,
        message: "Review and convert your captured items.",
        severity: "warning",
        entity_ref: { kind: "task", id: "inbox-summary" },
        action: { label: "Process", route: "/inbox" },
      });
    }
  }

  // Insert all new notifications
  if (newNotifs.length > 0) {
    const { error } = await supabase.from("notifications").insert(newNotifs);
    if (error) console.error(`Failed to insert notifications for ${userId}:`, error);
  }

  return newNotifs.length;
}

// ── Automation Time Triggers ──
async function runTimeAutomationsForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  todayStr: string,
  now: Date
): Promise<number> {
  // Get enabled time-based rules
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true)
    .is("deleted_at", null);

  if (!rules || rules.length === 0) return 0;

  // Get today's run logs for throttle checking
  const { data: todayLogs } = await supabase
    .from("automation_run_logs")
    .select("rule_id, ran_at, status")
    .eq("user_id", userId)
    .gte("ran_at", todayStr);

  const logs = todayLogs || [];
  let runsExecuted = 0;

  for (const rule of rules) {
    const trigger = rule.trigger as any;
    if (trigger.type !== "time") continue;

    // Check if should run now
    const schedule = trigger.schedule;
    const [h, m] = (schedule.time || "00:00").split(":").map(Number);
    const scheduledTime = new Date(now);
    scheduledTime.setHours(h, m, 0, 0);
    const diff = Math.abs(now.getTime() - scheduledTime.getTime());
    if (diff > 5 * 60 * 1000) continue; // 5 minute window (matches cron interval)

    // Check day of week for weekly triggers
    if (schedule.type === "weekly" && schedule.daysOfWeek) {
      const dayJS = now.getDay();
      const dayISO = dayJS === 0 ? 7 : dayJS;
      if (!schedule.daysOfWeek.includes(dayISO)) continue;
    }

    // Check if already ran today
    if (rule.last_run_at && rule.last_run_at.startsWith(todayStr)) continue;

    // Check throttle
    const throttle = rule.throttle as any || { maxRunsPerDay: 5, cooldownMinutes: 30 };
    const ruleTodayRuns = logs.filter((l: any) => l.rule_id === rule.id && l.status === "success");
    if (ruleTodayRuns.length >= throttle.maxRunsPerDay) {
      await insertLog(supabase, userId, rule.id, "throttled", "Max runs per day reached");
      continue;
    }

    if (rule.last_run_at) {
      const lastRun = new Date(rule.last_run_at);
      const cooldownEnd = new Date(lastRun.getTime() + throttle.cooldownMinutes * 60000);
      if (now < cooldownEnd) {
        await insertLog(supabase, userId, rule.id, "throttled", "Cooldown active");
        continue;
      }
    }

    // Evaluate conditions
    const conditionsMet = await evaluateConditionsServerSide(supabase, userId, rule.conditions as any[], todayStr, now);
    if (!conditionsMet) {
      await insertLog(supabase, userId, rule.id, "skipped", "Conditions not met");
      continue;
    }

    // Execute actions
    const createdRefs = await executeActionsServerSide(supabase, userId, rule.actions as any[], todayStr);
    await insertLog(supabase, userId, rule.id, "success", null, createdRefs);

    // Update last_run_at
    await supabase.from("automation_rules").update({ last_run_at: now.toISOString() }).eq("id", rule.id);

    runsExecuted++;
  }

  return runsExecuted;
}

async function evaluateConditionsServerSide(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  conditions: any[],
  todayStr: string,
  now: Date
): Promise<boolean> {
  for (const cond of conditions || []) {
    switch (cond.type) {
      case "time_is_after": {
        const hhmm = now.toISOString().slice(11, 16);
        if (hhmm < cond.value) return false;
        break;
      }
      case "day_of_week_is": {
        const dayJS = now.getDay();
        const dayISO = dayJS === 0 ? 7 : dayJS;
        if (dayISO !== cond.value) return false;
        break;
      }
      case "limit_unprocessed_inbox_gte": {
        const { count } = await supabase
          .from("inbox_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "unprocessed")
          .is("deleted_at", null);
        if ((count || 0) < cond.value) return false;
        break;
      }
    }
  }
  return true;
}

async function executeActionsServerSide(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  actions: any[],
  todayStr: string
): Promise<{ kind: string; id: string }[]> {
  const createdRefs: { kind: string; id: string }[] = [];
  const nowISO = new Date().toISOString();

  for (const action of actions || []) {
    switch (action.type) {
      case "create_task": {
        const { data } = await supabase.from("tasks").insert({
          user_id: userId,
          title: action.payload.title,
          description: action.payload.description || null,
          status: "todo",
          priority: action.payload.priority || "med",
          due_date: action.payload.dueDate || null,
          tags: action.payload.tags || [],
          subtasks: [],
          source: "automation",
          created_at: nowISO,
          updated_at: nowISO,
        }).select("id").single();
        if (data) createdRefs.push({ kind: "task", id: data.id });
        break;
      }
      case "create_focus_block_next_free": {
        // Find next free window for today
        const { data: events } = await supabase.from("calendar_events")
          .select("start_date_time, end_date_time")
          .eq("user_id", userId).is("deleted_at", null)
          .gte("start_date_time", todayStr + "T00:00:00")
          .lte("start_date_time", todayStr + "T23:59:59");
        const { data: blocks } = await supabase.from("focus_blocks")
          .select("start_date_time, end_date_time")
          .eq("user_id", userId).is("deleted_at", null)
          .gte("start_date_time", todayStr + "T00:00:00")
          .lte("start_date_time", todayStr + "T23:59:59");

        const allItems = [
          ...(events || []).map((e: any) => ({ start: new Date(e.start_date_time), end: new Date(e.end_date_time) })),
          ...(blocks || []).map((b: any) => ({ start: new Date(b.start_date_time), end: new Date(b.end_date_time) })),
        ].sort((a, b) => a.start.getTime() - b.start.getTime());

        const day = new Date(todayStr);
        let cursor = new Date(day); cursor.setHours(8, 0, 0, 0);
        const endOfDay = new Date(day); endOfDay.setHours(20, 0, 0, 0);
        const dur = action.payload.durationMinutes || 60;

        let startDT = cursor;
        for (const item of allItems) {
          if (new Date(cursor.getTime() + dur * 60000) <= item.start) { startDT = cursor; break; }
          cursor = item.end > cursor ? item.end : cursor;
        }
        if (new Date(cursor.getTime() + dur * 60000) <= endOfDay) startDT = cursor;

        const endDT = new Date(startDT.getTime() + dur * 60000);

        const { data } = await supabase.from("focus_blocks").insert({
          user_id: userId,
          title: action.payload.title || "Focus Block",
          start_date_time: startDT.toISOString(),
          end_date_time: endDT.toISOString(),
          linked_task_id: action.payload.linkedTaskId || null,
          status: "planned",
          created_at: nowISO,
          updated_at: nowISO,
        }).select("id").single();
        if (data) createdRefs.push({ kind: "focusBlock", id: data.id });
        break;
      }
      case "create_notification": {
        const { data } = await supabase.from("notifications").insert({
          user_id: userId,
          type: action.payload.type,
          title: action.payload.title,
          message: action.payload.message,
          severity: action.payload.severity || "info",
          route: action.payload.route || null,
          created_at: nowISO,
        }).select("id").single();
        if (data) createdRefs.push({ kind: "notification", id: data.id });
        break;
      }
      case "add_inbox_item": {
        const { data } = await supabase.from("inbox_items").insert({
          user_id: userId,
          content: action.payload.content,
          title: (action.payload.content || "").slice(0, 60),
          tags: action.payload.tags || [],
          status: "unprocessed",
          source: "manual",
          pinned: false,
          detected: {},
          created_at: nowISO,
          updated_at: nowISO,
        }).select("id").single();
        if (data) createdRefs.push({ kind: "inbox", id: data.id });
        break;
      }
      case "apply_template": {
        const { data: template } = await supabase.from("templates")
          .select("*")
          .eq("id", action.payload.templateId)
          .is("deleted_at", null)
          .single();

        if (template && (template.is_built_in || template.user_id === userId)) {
          const items = (template.items || []) as any[];
          for (const item of items) {
            if (item.type === "task" || item.kind === "task") {
              const { data } = await supabase.from("tasks").insert({
                user_id: userId,
                title: item.title || "Untitled Task",
                status: "todo",
                priority: item.priority || "med",
                tags: item.tags || [],
                subtasks: [],
                source: "template",
                created_at: nowISO,
                updated_at: nowISO,
              }).select("id").single();
              if (data) createdRefs.push({ kind: "task", id: data.id });
            }
          }
        }
        break;
      }
    }
  }

  return createdRefs;
}

async function insertLog(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ruleId: string,
  status: string,
  reason: string | null,
  createdRefs?: { kind: string; id: string }[]
) {
  await supabase.from("automation_run_logs").insert({
    user_id: userId,
    rule_id: ruleId,
    ran_at: new Date().toISOString(),
    status,
    reason: reason || null,
    created_entity_refs: createdRefs || [],
    undo_token: createdRefs && createdRefs.length > 0 ? { kind: "entityBatch", ids: createdRefs } : null,
  });
}
