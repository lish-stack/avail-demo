// supabase/functions/run-demo/index.ts
// Live Tier 1 citation-check demo backend for demoavail.considersentience.ai
// Deploy: supabase functions deploy run-demo
// Secrets needed (set via `supabase secrets set`):
//   ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
// Uses the Supabase service role automatically via env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CallResult = { citations: string[]; responseText: string };

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
  "Balanced": ["balanced.org"],
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

// Google Gemini with Google Search grounding. Citations come back as
// vertexaisearch redirect links, so resolve each to its real page before matching.
// Gemini often returns transient 503/429 "high demand" errors, so retry with backoff.
const GEMINI_MODEL = "gemini-3.7-flash";

async function resolveRedirect(uri: string, title?: string): Promise<string> {
  if (!uri.includes("vertexaisearch.cloud.google.com")) return uri;
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(uri, { method, redirect: "follow", signal: AbortSignal.timeout(5000) });
      if (res.url && !res.url.includes("vertexaisearch.cloud.google.com")) return res.url;
    } catch (_e) { /* try next method */ }
  }
  // Fallback: the grounding chunk title is normally the source's domain
  if (title && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(title)) return `https://${title}/`;
  return uri;
}

async function callGemini(question: string): Promise<CallResult> {
  let data: any;
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
        body: JSON.stringify({
          contents: [{ parts: [{ text: question }] }],
          tools: [{ google_search: {} }],
        }),
      },
    );
    data = await res.json();
    if (res.ok) { lastErr = ""; break; }
    lastErr = `Gemini error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`;
    if (![429, 500, 503].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (lastErr) throw new Error(lastErr);

  const candidate = (data.candidates || [])[0];
  const responseText = (candidate?.content?.parts || []).map((p: any) => p.text || "").join("\n");
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const citations = (await Promise.all(
    chunks.filter((c: any) => c.web?.uri).map((c: any) => resolveRedirect(c.web.uri, c.web.title)),
  )) as string[];
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
    const [claudeResult, perplexityResult, openaiResult, geminiResult] = await Promise.allSettled([
      callClaude(question),
      callPerplexity(question),
      callOpenAI(question),
      callGemini(question),
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
      formatResult("Gemini", geminiResult),
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
