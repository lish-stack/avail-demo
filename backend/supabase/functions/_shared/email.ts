// _shared/email.ts
// Sends email through Resend (https://resend.com). Never throws: if the key isn't set or the
// send fails, it logs and returns false so tracker creation and runs are never blocked.
//
// Secrets (supabase secrets set ...):
//   RESEND_API_KEY   from resend.com > API Keys
//   EMAIL_FROM       e.g. "AVAIL <avail@considersentience.ai>" (domain must be verified in Resend)
//   SITE_URL         e.g. https://demoavail.considersentience.ai   (no trailing slash)

export const siteUrl = () => (Deno.env.get("SITE_URL") ?? "https://demoavail.considersentience.ai").replace(/\/$/, "");

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!key || !from) {
    console.error("email skipped: RESEND_API_KEY or EMAIL_FROM not set");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      console.error("email failed:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("email error:", String(err).slice(0, 300));
    return false;
  }
}

const FOOTER =
  "\n\nYou're getting this because this email address was entered when setting up this tracker. " +
  "You can pause or delete the tracker any time from the link above, or reply to this email and we'll remove you.\n\n" +
  "AVAIL (Animal Visibility AI Landscape) is an experimental research preview by Consider Sentience.";

export function welcomeEmail(orgName: string, token: string, frequency: string) {
  const link = `${siteUrl()}/t/${token}`;
  const later = frequency === "once"
    ? ""
    : `\n\nThis tracker re-checks ${frequency}, and we'll email you each time new results are ready.`;
  return {
    subject: `Your AVAIL citation report for ${orgName}`,
    text:
      `Your citation tracking report for ${orgName} is being prepared. Results fill in over the next few minutes at this private link:\n\n${link}\n\n` +
      `Bookmark it: anyone with the link can view the report, so share it only with people you trust.` + later + FOOTER,
  };
}

export function updatedEmail(orgName: string, token: string, citedPct: number | null) {
  const link = `${siteUrl()}/t/${token}`;
  const line = citedPct === null ? "" : `\n\nIn this run, ${orgName}'s own website was cited in ${citedPct}% of answers.`;
  return {
    subject: `New results for ${orgName} on AVAIL`,
    text: `A new check of your question list just finished.${line}\n\nSee the full report, including what changed since last time:\n\n${link}` + FOOTER,
  };
}
