import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use a chat model to expand the query into alternative keywords/synonyms
async function expandQuery(apiKey: string, originalQuery: string): Promise<string[]> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a search query expander. Given a user's search query about their personal productivity data (tasks, goals, events, habits, notes, inbox items), output 3-5 alternative search terms that would help find relevant items. Include synonyms, related words, and rephrased versions. Output ONLY a JSON array of strings, nothing else. Example: ["workout", "exercise", "gym", "fitness"]`,
          },
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

    // Parse JSON array from response
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
    const { query, kinds, limit = 10 } = body as { query: string; kinds?: string[]; limit?: number };

    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [], expanded: [] }), { headers: jsonHeaders });
    }

    // Step 1: Expand query using chat model
    const expandedTerms = lovableKey
      ? await expandQuery(lovableKey, query.trim())
      : [query.trim()];

    console.log("Expanded terms:", expandedTerms);

    // Step 2: Search with each expanded term using the DB function, collect unique results
    const resultMap = new Map<string, any>();
    const typesParam = kinds && kinds.length > 0 ? kinds : null;

    for (const term of expandedTerms) {
      const { data: searchResults, error: searchErr } = await supabase
        .rpc("search_entities", {
          p_user_id: userId,
          p_query: term,
          p_types: typesParam,
          p_limit: limit,
        });

      if (searchErr) {
        console.error("Search error for term", term, ":", searchErr);
        continue;
      }

      for (const r of (searchResults || [])) {
        const key = `${r.entity_type}:${r.entity_id}`;
        if (!resultMap.has(key)) {
          resultMap.set(key, { ...r, matchedTerms: [term] });
        } else {
          // Boost score for items matching multiple terms
          const existing = resultMap.get(key);
          existing.score = Math.max(existing.score, r.score);
          existing.matchedTerms.push(term);
        }
      }
    }

    // Step 3: Sort by number of matched terms (desc), then score (desc)
    const results = Array.from(resultMap.values())
      .sort((a, b) => {
        const termDiff = b.matchedTerms.length - a.matchedTerms.length;
        if (termDiff !== 0) return termDiff;
        return b.score - a.score;
      })
      .slice(0, limit)
      .map(r => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        title: r.title,
        snippet: r.snippet,
        score: r.score,
        metadata: r.metadata,
      }));

    return new Response(
      JSON.stringify({ results, expanded: expandedTerms, count: results.length }),
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
