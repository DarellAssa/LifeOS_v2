import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      description:
        "Search the user's LifeOS data. Use this to find tasks, goals, events, habits, inbox items, notes, etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          types: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "tasks",
                "goals",
                "events",
                "focusBlocks",
                "habits",
                "inbox",
                "notes",
                "weeklyPlans",
                "notifications",
              ],
            },
            description: "Which data types to search",
          },
          limit: { type: "number", description: "Max results per type" },
          filters: {
            type: "object",
            description: "Optional filters like status, priority, dateRange",
            properties: {
              status: { type: "string" },
              priority: { type: "string" },
              dateRange: {
                type: "object",
                properties: {
                  start: { type: "string" },
                  end: { type: "string" },
                },
              },
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
      description:
        "Schedule a focus block for a task. If startTime is omitted, uses next free window.",
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
          category: {
            type: "string",
            enum: ["work", "personal", "study", "health", "custom"],
          },
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
          category: {
            type: "string",
            enum: [
              "health",
              "career",
              "finance",
              "study",
              "personal",
              "custom",
            ],
          },
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
      description: "Convert inbox items into tasks, events, goals, habits, or notes.",
      parameters: {
        type: "object",
        properties: {
          inboxIds: { type: "array", items: { type: "string" } },
          convertTo: {
            type: "string",
            enum: ["task", "event", "goal", "habit", "note"],
          },
          defaults: {
            type: "object",
            description: "Default fields for the created entities",
          },
        },
        required: ["inboxIds", "convertTo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_template",
      description: "Apply a template to create entities.",
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

// Rate limiting: simple in-memory per-request tracking
const requestLog: { ts: number }[] = [];
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  // Clean old entries
  while (requestLog.length > 0 && requestLog[0].ts < windowStart) {
    requestLog.shift();
  }
  if (requestLog.length >= MAX_REQUESTS_PER_MINUTE) return false;
  requestLog.push({ ts: now });
  return true;
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

    const { messages, memoryPack, toolResults } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build messages array for the AI
    const aiMessages: any[] = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n## Current LifeOS Memory Pack\n${memoryPack || "No data available."}`,
      },
      ...messages,
    ];

    // If we have tool results, append them
    if (toolResults && toolResults.length > 0) {
      for (const tr of toolResults) {
        aiMessages.push({
          role: "tool",
          tool_call_id: tr.tool_call_id,
          content: JSON.stringify(tr.output),
        });
      }
    }

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: aiMessages,
      tools: TOOLS,
      stream: true,
      max_tokens: 2048,
    };

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("copilot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
