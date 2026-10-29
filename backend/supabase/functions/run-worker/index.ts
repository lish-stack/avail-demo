// supabase/functions/run-worker/index.ts
// Queue worker, called every minute by pg_cron (see tracker_schema.sql).
// Deploy WITHOUT jwt verification; it authenticates with a shared secret header:
//   supabase functions deploy run-worker --no-verify-jwt
//   supabase secrets set WORKER_SECRET=<long random string>
//
// Each invocation: (1) schedules due trackers, (2) un-sticks stale claims,
// (3) processes a small batch of pending items, (4) closes finished runs.
// Small batches keep each call well inside edge-function time limits, and the
// queue makes runs resumable if anything fails midway.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CALLERS, hostOf, matchesDomains } from "../_shared/assistants.ts";

const BATCH_SIZE = 10;
const DAILY_ITEM_CAP = 500;      // hard ceiling on API calls per day across all trackers
const DAILY_CHATGPT_CAP = 100;   // ChatGPT is ~10x the cost of the others; separate ceiling (~$10-15/day worst case)
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MINUTES = 10;

function nextRunAt(frequency: string): string | null {
  const d = new Date();
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString();
}

serve(async (req: Request) => {
  if (req.headers.get("x-worker-secret") !== Deno.env.get("WORKER_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const summary = { scheduled: 0, processed: 0, skippedForCap: false };

  try {
    // 1. Schedule due trackers (create a run + queue items, advance next_run_at)
    const { data: due } = await supabase.from("trackers").select("*")
      .eq("active", true).not("next_run_at", "is", null)
      .lte("next_run_at", new Date().toISOString()).limit(5);

    for (const t of due ?? []) {
      const { data: qs } = await supabase.from("tracker_questions").select("id").eq("tracker_id", t.id).eq("removed", false);
      // Advance first so a failure below can't cause a double-schedule
      await supabase.from("trackers").update({ next_run_at: nextRunAt(t.frequency) }).eq("id", t.id);
      if (!qs?.length) continue;
      const { data: run } = await supabase.from("tracker_runs")
        .insert({ tracker_id: t.id, run_type: "scheduled" }).select().single();
      await supabase.from("run_items").insert(
        qs.flatMap((q) => (t.assistants as string[]).map((assistant) => ({
          run_id: run!.id, tracker_id: t.id, question_id: q.id, assistant,
        }))));
      summary.scheduled++;
    }

    // 2. Release items stuck in 'processing' (worker died mid-batch)
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MINUTES * 60 * 1000).toISOString();
    await supabase.from("run_items").update({ status: "pending", claimed_at: null })
      .eq("status", "processing").lt("claimed_at", staleBefore);

    // 3. Daily budget check
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const { count: doneToday } = await supabase.from("run_items")
      .select("*", { count: "exact", head: true }).gte("processed_at", dayStart.toISOString());
    if ((doneToday ?? 0) >= DAILY_ITEM_CAP) {
      summary.skippedForCap = true;
      return Response.json(summary);
    }

    // 4. Claim a batch (conditional update guards against double-claiming)
    const { count: gptToday } = await supabase.from("run_items")
      .select("*", { count: "exact", head: true })
      .eq("assistant", "chatgpt").gte("processed_at", dayStart.toISOString());
    let pendingQuery = supabase.from("run_items").select("id").eq("status", "pending");
    // Once the ChatGPT budget is spent, keep processing everything else; GPT items wait for tomorrow
    if ((gptToday ?? 0) >= DAILY_CHATGPT_CAP) pendingQuery = pendingQuery.neq("assistant", "chatgpt");
    const { data: pending } = await pendingQuery.order("id").limit(BATCH_SIZE);
    const ids = (pending ?? []).map((p) => p.id);
    if (ids.length) {
      const { data: claimed } = await supabase.from("run_items")
        .update({ status: "processing", claimed_at: new Date().toISOString() })
        .in("id", ids).eq("status", "pending")
        .select("id, run_id, tracker_id, question_id, assistant, attempts");

      // Look up question text + tracker domains for this batch
      const qIds = [...new Set((claimed ?? []).map((c) => c.question_id))];
      const tIds = [...new Set((claimed ?? []).map((c) => c.tracker_id))];
      const [{ data: qRows }, { data: tRows }] = await Promise.all([
        supabase.from("tracker_questions").select("id, question_text").in("id", qIds),
        supabase.from("trackers").select("id, org_domains").in("id", tIds),
      ]);
      const qText = Object.fromEntries((qRows ?? []).map((q) => [q.id, q.question_text]));
      const tDomains = Object.fromEntries((tRows ?? []).map((t) => [t.id, t.org_domains as string[]]));

      await Promise.allSettled((claimed ?? []).map(async (item) => {
        try {
          const caller = CALLERS[item.assistant];
          if (!caller) throw new Error("unknown assistant");
          const { citations } = await caller(qText[item.question_id]);
          const domains = tDomains[item.tracker_id] ?? [];
          const matchedUrl = citations.find((u) => matchesDomains(u, domains)) ?? null;
          const citedDomains = [...new Set(citations.map(hostOf).filter((h): h is string => !!h))];
          await supabase.from("run_items").update({
            status: "ok", cited: !!matchedUrl, matched_url: matchedUrl,
            cited_domains: citedDomains, total_citations: citations.length,
            processed_at: new Date().toISOString(),
          }).eq("id", item.id);
        } catch (err) {
          // Log the reason so failures can be diagnosed in Dashboard > Edge Functions > run-worker > Logs
          console.error("item failed:", item.assistant, String(err).slice(0, 500));
          const attempts = item.attempts + 1;
          await supabase.from("run_items").update(
            attempts >= MAX_ATTEMPTS
              ? { status: "unavailable", attempts, processed_at: new Date().toISOString() }
              : { status: "pending", attempts, claimed_at: null },
          ).eq("id", item.id);
        }
        summary.processed++;
      }));
    }

    // 5. Close runs with nothing left to do
    const { data: open } = await supabase.from("tracker_runs").select("id").eq("status", "running").limit(50);
    for (const r of open ?? []) {
      const { count } = await supabase.from("run_items").select("*", { count: "exact", head: true })
        .eq("run_id", r.id).in("status", ["pending", "processing"]);
      if ((count ?? 0) === 0) {
        await supabase.from("tracker_runs")
          .update({ status: "done", completed_at: new Date().toISOString() }).eq("id", r.id);
      }
    }

    return Response.json(summary);
  } catch (err) {
    return Response.json({ error: String(err), ...summary }, { status: 500 });
  }
});
