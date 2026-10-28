// supabase/functions/tracker/index.ts
// Public API for saved trackers. Deploy WITH jwt verification (default):
//   supabase functions deploy tracker
// The frontend calls it with the anon key; all DB access happens here via service role.
//
// POST { action: "create" | "get" | "update" | "delete", ... }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ASSISTANT_LABELS, KNOWN_ORGS } from "../_shared/assistants.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Budget guards (tune to your funding level)
const MAX_QUESTIONS = 25;
const MAX_ACTIVE_TRACKERS = 15;       // global, across all visitors (raise once funded)
const MAX_CREATES_PER_IP_PER_DAY = 3;
const DEFAULT_ASSISTANTS = ["claude", "perplexity", "chatgpt", "gemini"];
const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nextRunAt(frequency: string): string | null {
  const d = new Date();
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString();
}

function cleanDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---------- CREATE ----------
    if (body.action === "create") {
      const orgName = String(body.orgName || "").trim().slice(0, 80);
      if (!orgName) return json({ error: "Organization name is required." }, 400);

      // Known orgs use their verified domains; anyone else supplies their own.
      const knownKey = Object.keys(KNOWN_ORGS).find((k) => k.toLowerCase() === orgName.toLowerCase());
      let domains: string[] = knownKey ? KNOWN_ORGS[knownKey] : [];
      if (domains.length === 0) {
        domains = (Array.isArray(body.domains) ? body.domains : [])
          .map((d: unknown) => cleanDomain(String(d)))
          .filter((d: string) => DOMAIN_RE.test(d))
          .slice(0, 5);
        if (domains.length === 0) return json({ error: "Add at least one valid website domain, e.g. example.org." }, 400);
      }

      const frequency = ["once", "weekly", "monthly"].includes(body.frequency) ? body.frequency : "weekly";

      // Questions: trimmed, de-duplicated, length-checked
      const seen = new Set<string>();
      const questions: string[] = [];
      for (const q of Array.isArray(body.questions) ? body.questions : []) {
        const t = String(q).trim().replace(/\s+/g, " ");
        if (!t || seen.has(t.toLowerCase())) continue;
        if (t.length > 300) return json({ error: "Each question must be under 300 characters." }, 400);
        seen.add(t.toLowerCase());
        questions.push(t);
      }
      if (questions.length === 0) return json({ error: "Add at least one question." }, 400);
      if (questions.length > MAX_QUESTIONS) {
        return json({ error: `Lists are limited to ${MAX_QUESTIONS} questions in this free demo.` }, 400);
      }

      // Optional email: only stored if it looks like one
      const email = typeof body.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email.trim())
        ? body.email.trim().slice(0, 200) : null;

      // Rate limit: per-IP creates per day + global active cap
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
      const creatorHash = await sha256(ip + (Deno.env.get("HASH_SALT") ?? "avail"));
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: ipCount } = await supabase
        .from("trackers").select("*", { count: "exact", head: true })
        .eq("creator_hash", creatorHash).gte("created_at", since);
      if ((ipCount ?? 0) >= MAX_CREATES_PER_IP_PER_DAY) {
        return json({ error: "Limit reached for today. Please try again tomorrow." }, 429);
      }
      const { count: activeCount } = await supabase
        .from("trackers").select("*", { count: "exact", head: true }).eq("active", true);
      if ((activeCount ?? 0) >= MAX_ACTIVE_TRACKERS) {
        return json({ error: "The free demo is at capacity right now. Please check back soon, or contact us." }, 429);
      }

      const { data: tracker, error: tErr } = await supabase.from("trackers").insert({
        org_name: orgName,
        org_domains: domains,
        frequency,
        assistants: DEFAULT_ASSISTANTS,
        report_email: email,
        next_run_at: nextRunAt(frequency),
        creator_hash: creatorHash,
      }).select().single();
      if (tErr) throw new Error(tErr.message);

      const { data: qRows, error: qErr } = await supabase.from("tracker_questions")
        .insert(questions.map((question_text, position) => ({ tracker_id: tracker.id, position, question_text })))
        .select();
      if (qErr) throw new Error(qErr.message);

      // First run starts immediately (the worker picks up the queue)
      const { data: run, error: rErr } = await supabase.from("tracker_runs")
        .insert({ tracker_id: tracker.id, run_type: "initial" }).select().single();
      if (rErr) throw new Error(rErr.message);

      const items = qRows!.flatMap((q) =>
        DEFAULT_ASSISTANTS.map((assistant) => ({
          run_id: run.id, tracker_id: tracker.id, question_id: q.id, assistant,
        })));
      const { error: iErr } = await supabase.from("run_items").insert(items);
      if (iErr) throw new Error(iErr.message);

      return json({ token: tracker.token, questionCount: questions.length, totalChecks: items.length });
    }

    // Everything below needs a token
    const token = String(body.token || "");
    if (!/^[a-f0-9]{32}$/.test(token)) return json({ error: "Invalid link." }, 400);
    const { data: tracker } = await supabase.from("trackers").select("*").eq("token", token).maybeSingle();
    if (!tracker) return json({ error: "Tracker not found." }, 404);

    // ---------- GET ----------
    if (body.action === "get") {
      const [{ data: questions }, { data: runs }] = await Promise.all([
        supabase.from("tracker_questions").select("id, position, question_text")
          .eq("tracker_id", tracker.id).order("position"),
        supabase.from("tracker_runs").select("id, run_type, status, created_at, completed_at")
          .eq("tracker_id", tracker.id).order("created_at", { ascending: false }).limit(26),
      ]);

      const runIds = (runs ?? []).map((r) => r.id);
      let items: any[] = [];
      if (runIds.length) {
        // paginate past PostgREST's 1,000-row cap
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from("run_items")
            .select("run_id, question_id, assistant, status, cited, matched_url, cited_domains, total_citations")
            .in("run_id", runIds).range(from, from + 999);
          if (error) throw new Error(error.message);
          items = items.concat(data ?? []);
          if (!data || data.length < 1000) break;
        }
      }

      return json({
        tracker: {
          orgName: tracker.org_name, domains: tracker.org_domains, frequency: tracker.frequency,
          active: tracker.active, nextRunAt: tracker.next_run_at, hasEmail: !!tracker.report_email,
          assistants: tracker.assistants, createdAt: tracker.created_at,
        },
        assistantLabels: ASSISTANT_LABELS,
        questions, runs, items,
      });
    }

    // ---------- UPDATE (pause/resume, change frequency) ----------
    if (body.action === "update") {
      const patch: Record<string, unknown> = {};
      if (typeof body.active === "boolean") {
        patch.active = body.active;
        if (body.active && !tracker.next_run_at) patch.next_run_at = nextRunAt(tracker.frequency);
      }
      if (["once", "weekly", "monthly"].includes(body.frequency)) {
        patch.frequency = body.frequency;
        patch.next_run_at = nextRunAt(body.frequency);
      }
      if (Object.keys(patch).length === 0) return json({ error: "Nothing to update." }, 400);
      const { error } = await supabase.from("trackers").update(patch).eq("id", tracker.id);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    // ---------- DELETE ----------
    if (body.action === "delete") {
      const { error } = await supabase.from("trackers").delete().eq("id", tracker.id);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
