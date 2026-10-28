// supabase/functions/_shared/assistants.ts
// Shared by `tracker` and `run-worker`. (run-demo keeps its own copy on purpose,
// so changes here can't break the live demo.)

export type CallResult = { citations: string[]; responseText: string };

export const KNOWN_ORGS: Record<string, string[]> = {
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

// Default assistants for scheduled runs. ChatGPT is opt-in: reasoning tokens +
// search fees made it ~10x the cost of the others in the pilot.
export const ASSISTANT_LABELS: Record<string, string> = {
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  chatgpt: "ChatGPT",
};

export function hostOf(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Host equals the domain or is a subdomain of it (blog.peta.org matches peta.org).
export function matchesDomains(url: string, domains: string[]): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return domains.some((d) => host === d || host.endsWith("." + d));
}

async function callClaude(question: string): Promise<CallResult> {
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
  for (const block of textBlocks) for (const c of block.citations || []) if (c.url) citations.push(c.url);
  return { citations, responseText: textBlocks.map((b: any) => b.text).join("\n") };
}

async function callPerplexity(question: string): Promise<CallResult> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("PERPLEXITY_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: question }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Perplexity error: ${JSON.stringify(data)}`);
  return { citations: data.citations || [], responseText: data.choices?.[0]?.message?.content || "" };
}

async function callOpenAI(question: string): Promise<CallResult> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-5.6", tools: [{ type: "web_search" }], input: question }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI error: ${JSON.stringify(data)}`);
  let responseText = "";
  const citations: string[] = [];
  for (const msg of (data.output || []).filter((o: any) => o.type === "message")) {
    for (const c of msg.content || []) {
      if (c.text) responseText += c.text;
      for (const a of c.annotations || []) if (a.type === "url_citation" && a.url) citations.push(a.url);
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

export const CALLERS: Record<string, (q: string) => Promise<CallResult>> = {
  claude: callClaude,
  perplexity: callPerplexity,
  chatgpt: callOpenAI,
  gemini: callGemini,
};
