// supabase/functions/run-demo/index.ts
// Live Tier 1 citation-check demo backend for demoavail.considersentience.ai
// Deploy: supabase functions deploy run-demo
// Secrets needed (set via `supabase secrets set`):
//   ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, OPENAI_API_KEY
// Uses the Supabase service role automatically via env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same org domain list as the pilot's tier1-matching.mjs
const ORG_DOMAINS: Record<string, string[]> = {
  "Mercy For Animals": ["mercyforanimals.org"],
  "PETA": ["peta.org"],
  "The Humane League": ["thehumaneleague.org"],
  "Animal Equality": ["animalequality.org", "animalequality.org.uk"],
  "Compassion in World Farming": ["ciwf.org.uk", "ciwf.org", "ciwf.com"],
  "Farm Sanctuary": ["farmsanctuary.org"],
  "Vegan Outreach": ["veganoutreach.org"],
  "Faunalytics": ["faunalytics.org"],
  "World Animal Protection": ["worldanimalprotection.org"],
  "Humane Society International": ["humaneworld.org", "hsi.org"],
};

const DAILY_RUN_CAP = 150; // adjust based on your API budget comfort level

function normalizeAndExtractDomain(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    let host = url.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    // crude eTLD+1: last two labels (good enough for .org/.com/.uk-style domains
    // used by these specific orgs — not a full public-suffix-list implementation)
    return parts.length >= 2 ? parts.slice(-2).join(".") : host;
  } catch {
    return null;
  }
}

function checkOrgMatch(citations: string[], orgName: string): { matched: boolean; matchedUrl?: string } {
  const domains = ORG_DOMAINS[orgName] || [];
  for (const url of citations) {
    const domain = normalizeAndExtractDomain(url);
    if (domain && domains.includes(domain)) {
      return { matched: true, matchedUrl: url };
    }
  }
  return { matched: false };
}

async function callClaude(question: string): Promise<{ citations: string[]; responseText: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: question }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude error: ${JSON.stringify(data)}`);

  const textBlocks = (data.content || []).filter((b: any) => b.type === "text");
  const citations: string[] = [];
  for (const block of textBlocks) {
    for (const c of block.citations || []) {
      if (c.url) citations.push(c.url);
    }
  }
  return { citations, responseText: textBlocks.map((b: any) => b.text).join("\n") };
}

async function callPerplexity(question: string): Promise<{ citations: string[]; responseText: string }> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("PERPLEXITY_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: question }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Perplexity error: ${JSON.stringify(data)}`);

  return {
    citations: data.citations || [],
    responseText: data.choices?.[0]?.message?.content || "",
  };
}

async function callOpenAI(question: string): Promise<{ citations: string[]; responseText: string }> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.6",
      tools: [{ type: "web_search" }],
      input: question,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI error: ${JSON.stringify(data)}`);

  const messages = (data.output || []).filter((o: any) => o.type === "message");
  let responseText = "";
  const citations: string[] = [];
  for (const msg of messages) {
    for (const c of msg.content || []) {
      if (c.text) responseText += c.text;
      for (const a of c.annotations || []) {
        if (a.type === "url_citation" && a.url) citations.push(a.url);
      }
    }
  }
  return { citations, responseText };
}

// --- Open-weight model support (Together AI + Tavily search) ---
// Open-weight models don't have native web-search/citation like the four
// commercial assistants above, so we build the loop ourselves: search first
// (Tavily), hand the model numbered sources, ask which numbers it actually
// used, then map those back to real URLs. Safer than letting an open model
// generate URL strings freely, which risks hallucinated citations.

async function searchTavily(question: string): Promise<{ title: string; url: string; content: string }[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: Deno.env.get("TAVILY_API_KEY"),
      query: question,
      max_results: 6,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Tavily error: ${JSON.stringify(data)}`);
  return (data.results || []).map((r: any) => ({ title: r.title, url: r.url, content: r.content }));
}

async function callOpenModel(question: string): Promise<{ citations: string[]; responseText: string }> {
  const searchResults = await searchTavily(question);

  const sourceList = searchResults
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}\nURL: ${r.url}`)
    .join("\n\n");

  const prompt = `Answer the question using ONLY the sources below. After your answer, on a new line, write "SOURCES USED:" followed by a comma-separated list of the source numbers you actually drew on (e.g. "SOURCES USED: 1, 3"). If none of the sources are relevant, write "SOURCES USED: none".

Sources:
${sourceList}

Question: ${question}`;

  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("TOGETHER_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Together AI error: ${JSON.stringify(data)}`);

  const responseText: string = data.choices?.[0]?.message?.content || "";

  // Parse "SOURCES USED: 1, 3" out of the response
  const match = responseText.match(/SOURCES USED:\s*(.+)/i);
  let citations: string[] = [];
  if (match && !/none/i.test(match[1])) {
    const indices = match[1].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    citations = indices
      .map((i) => searchResults[i - 1]?.url)
      .filter((url): url is string => Boolean(url));
  }

  return { citations, responseText };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { orgName, question } = await req.json();

    if (!orgName || !ORG_DOMAINS[orgName]) {
      return new Response(JSON.stringify({ error: "Invalid or missing orgName" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }
    if (!question || typeof question !== "string" || question.length > 300) {
      return new Response(JSON.stringify({ error: "Invalid question (must be under 300 characters)" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit check — count today's runs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("demo_runs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    if ((count ?? 0) >= DAILY_RUN_CAP) {
      return new Response(
        JSON.stringify({ error: "Demo has reached its daily usage limit. Please try again tomorrow, or ask us for a live walkthrough." }),
        { status: 429, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // Log this run (fire and forget is fine, but await to keep it simple/reliable)
    await supabase.from("demo_runs").insert({ org_name: orgName, question_text: question });

    // Call all 3 assistants in parallel, independently — one failing shouldn't break the others
    const [claudeResult, perplexityResult, openaiResult, openModelResult] = await Promise.allSettled([
      callClaude(question),
      callPerplexity(question),
      callOpenAI(question),
      callOpenModel(question),
    ]);

    function formatResult(label: string, result: PromiseSettledResult<{ citations: string[]; responseText: string }>) {
      if (result.status === "rejected") {
        return { assistant: label, status: "unavailable", error: "Temporarily unavailable" };
      }
      const match = checkOrgMatch(result.value.citations, orgName);
      return {
        assistant: label,
        status: "ok",
        cited: match.matched,
        matchedUrl: match.matchedUrl ?? null,
        totalCitations: result.value.citations.length,
      };
    }

    const results = [
      formatResult("Claude", claudeResult),
      formatResult("Perplexity", perplexityResult),
      formatResult("ChatGPT", openaiResult),
      formatResult("Llama 3.3 (open-weight)", openModelResult),
    ];

    return new Response(JSON.stringify({ orgName, question, results }), {
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
