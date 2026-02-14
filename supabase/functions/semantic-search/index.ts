import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Route mapping ──
const ROUTE_MAP: Record<string, string> = {
  task: "/tasks",
  goal: "/goals",
  note: "/notes",
  inbox: "/inbox",
  event: "/calendar",
  focus: "/calendar",
  habit: "/habits",
};

// ── Shared expansion prompt (single source of truth) ──
const EXPANSION_SYSTEM_PROMPT = `You are a search query expander for a personal productivity app (tasks, goals, events, habits, notes, inbox items, focus blocks).
Given a user's search query, output a JSON array of 3-5 alternative search terms including synonyms, related words, and rephrased versions.
Output ONLY a JSON array of strings, nothing else.
Example: ["workout", "exercise", "gym", "fitness"]`;

export async function expandQuery(apiKey: string, originalQuery: string): Promise<string[]> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: EXPANSION_SYSTEM_PROMPT },
          { role: "user", content: originalQuery },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      console.warn("Query expansion failed:", resp.status);
      return [originalQuery];
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      const terms = JSON.parse(match[0]) as string[];
      return [originalQuery, ...terms.slice(0, 5)];
    }
    return [originalQuery];
  } catch (err) {
    console.warn("Query expansion error:", err);
    return [originalQuery];
  }
}

export interface SearchResult {
  entity_type: string;
  entity_id: string;
  title: string;
  snippet: string;
  score: number;
  metadata: Record<string, unknown>;
  route: string;
  matched_terms: string[];
}

export async function performSearch(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  query: string,
  kinds: string[] | null,
  limit: number,
  apiKey?: string,
): Promise<{ results: SearchResult[]; expanded: string[] }> {
  // Guard empty queries
  if (!query || query.trim().length === 0) {
    return { results: [], expanded: [] };
  }

  const trimmed = query.trim();

  // Expand query if API key available
  const expandedTerms = apiKey
    ? await expandQuery(apiKey, trimmed)
    : [trimmed];

  console.log("Expanded terms:", expandedTerms);

  // Search with each expanded term, collect unique results
  const resultMap = new Map<string, SearchResult>();

  for (const term of expandedTerms) {
    const { data: searchResults, error: searchErr } = await supabase
      .rpc("search_entities", {
        p_user_id: userId,
        p_query: term,
        p_types: kinds && kinds.length > 0 ? kinds : null,
        p_limit: limit,
      });

    if (searchErr) {
      console.error("Search error for term", term, ":", searchErr);
      continue;
    }

    for (const r of (searchResults || [])) {
      const key = `${r.entity_type}:${r.entity_id}`;
      if (!resultMap.has(key)) {
        resultMap.set(key, {
          entity_type: r.entity_type,
          entity_id: r.entity_id,
          title: r.title,
          snippet: r.snippet,
          score: r.score,
          metadata: r.metadata || {},
          route: ROUTE_MAP[r.entity_type] || "/",
          matched_terms: [term],
        });
      } else {
        const existing = resultMap.get(key)!;
        existing.score = Math.max(existing.score, r.score);
        existing.matched_terms.push(term);
      }
    }
  }

  // Sort: more matched terms first, then score
  const results = Array.from(resultMap.values())
    .sort((a, b) => {
      const termDiff = b.matched_terms.length - a.matched_terms.length;
      if (termDiff !== 0) return termDiff;
      return b.score - a.score;
    })
    .slice(0, limit);

  return { results, expanded: expandedTerms };
}

// ── HTTP handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

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

    const body = await req.json();
    const { query, kinds, limit = 12 } = body as { query: string; kinds?: string[]; limit?: number };

    const { results, expanded } = await performSearch(supabase, userId, query, kinds || null, limit, lovableKey);

    return new Response(
      JSON.stringify({ results, expanded, count: results.length }),
      { headers: jsonHeaders }
    );
  } catch (err: any) {
    console.error("semantic-search error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
