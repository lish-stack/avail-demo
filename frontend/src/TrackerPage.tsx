import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dot,
  STATUS,
  Segmented,
  SiteFooter,
  SiteHeader,
  SUPABASE_ANON_KEY,
  TRACKER_URL,
  Wordmark,
  primaryBtn,
  secondaryBtn,
  wdth,
} from './shared';
import { modelByKey } from './models';

type Item = {
  run_id: string;
  question_id: string;
  assistant: string;
  status: 'pending' | 'processing' | 'ok' | 'unavailable';
  cited: boolean | null;
  matched_url: string | null;
  cited_domains: string[] | null;
  total_citations: number | null;
};
type Run = { id: string; run_type: string; status: 'running' | 'done'; created_at: string; completed_at: string | null };
type Data = {
  tracker: {
    orgName: string;
    domains: string[];
    frequency: 'once' | 'weekly' | 'monthly';
    active: boolean;
    nextRunAt: string | null;
    assistants: string[];
  };
  questions: { id: string; position: number; question_text: string }[];
  runs: Run[];
  items: Item[];
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

async function call(body: Record<string, unknown>) {
  const res = await fetch(TRACKER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function rateFor(items: Item[], runId: string, assistant: string): { rate: number | null; n: number } {
  const ok = items.filter((i) => i.run_id === runId && i.assistant === assistant && i.status === 'ok');
  if (!ok.length) return { rate: null, n: 0 };
  return { rate: (ok.filter((i) => i.cited).length / ok.length) * 100, n: ok.length };
}

const th = 'font-semibold leading-[16px] text-slate text-[11px] uppercase';

export default function TrackerPage({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await call({ action: 'get', token }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const latest = data?.runs[0];
  const running = latest?.status === 'running';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [running, load]);

  const derived = useMemo(() => {
    if (!data || !latest) return null;
    const latestItems = data.items.filter((i) => i.run_id === latest.id);
    const done = latestItems.filter((i) => i.status === 'ok' || i.status === 'unavailable').length;
    const previous = data.runs.slice(1).find((r) => r.status === 'done');
    // Who gets cited in the latest run (excluding the org's own domains)
    const counts: Record<string, number> = {};
    for (const i of latestItems) {
      for (const d of i.cited_domains ?? []) {
        if (data.tracker.domains.some((own) => d === own || d.endsWith('.' + own))) continue;
        counts[d] = (counts[d] ?? 0) + 1;
      }
    }
    const topDomains = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { latestItems, done, total: latestItems.length, previous, topDomains };
  }, [data, latest]);

  async function act(body: Record<string, unknown>) {
    try {
      await call({ token, ...body });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function del() {
    try {
      await call({ action: 'delete', token });
      window.location.assign('/');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-ink flex flex-col items-center w-full min-h-screen relative">
      <SiteHeader />
      <section className="flex flex-col gap-[32px] items-center pb-4 pt-[120px] xl:pt-[160px] px-[24px] md:px-[128px] xl:px-[256px] w-full">
        <Wordmark />
      </section>

      <section className="flex flex-col gap-6 items-start px-[24px] md:px-[94px] xl:px-[256px] py-8 w-full">
        {error && !data && (
          <div className="bg-cloud border border-rust rounded-lg p-6 w-full max-w-[766px] mx-auto text-center">
            <p className="text-ink text-[16px] mb-4" style={wdth}>{error}</p>
            <a href="/" className={secondaryBtn} style={wdth}>back to avail</a>
          </div>
        )}

        {data && latest && derived && (
          <div className="flex flex-col gap-6 w-full max-w-[980px] mx-auto">
            {/* Title */}
            <div className="flex flex-col gap-2">
              <p className="text-[20px] md:text-[28px] tracking-[0.4px] md:tracking-[0.56px] uppercase text-cloud" style={wdth}>
                <span className="text-rust">{data.tracker.orgName}</span>
              </p>
              <p className="text-cloud text-[15px]" style={wdth}>
                {data.questions.length} questions ·{' '}
                {data.tracker.frequency === 'once' ? 'one-time check' : `checked ${data.tracker.frequency}`}
                {data.tracker.nextRunAt && data.tracker.active ? ` · next run ${fmtDate(data.tracker.nextRunAt)}` : ''}
                {!data.tracker.active ? ' · paused' : ''}
              </p>
            </div>

            {/* Private link note */}
            <div className="bg-cloud border border-rust rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-slate text-[14px] leading-[1.6]" style={wdth}>
                <span className="font-medium text-ink">This is a private link.</span> Anyone who has it can view this
                tracker, so bookmark it and share it only with people you trust.
              </p>
              <button type="button" onClick={copyLink} className={secondaryBtn} style={wdth}>
                {copied ? 'copied' : 'copy link'}
              </button>
            </div>

            {/* Progress */}
            {running && (
              <div className="bg-cloud border border-rust rounded-lg p-4 flex flex-col gap-3">
                <p className="text-ink text-[14px] font-medium" style={wdth}>
                  Checking… {derived.done} of {derived.total} done
                </p>
                <div className="h-2 rounded-full bg-slate/15 overflow-hidden">
                  <div
                    className="h-full bg-rust transition-all"
                    style={{ width: `${derived.total ? (derived.done / derived.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-slate text-[13px]" style={wdth}>
                  You can close this page and come back to this link. Results appear as they finish.
                </p>
              </div>
            )}

            {/* Per-model rate cards */}
            <div className="flex flex-col gap-3">
              <p className="font-medium text-cloud text-[16px] tracking-[0.28px] uppercase" style={wdth}>
                Cited directly, latest run{latest.status === 'running' ? ' (so far)' : ''}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {data.tracker.assistants.map((key) => {
                  const m = modelByKey(key);
                  const cur = rateFor(data.items, latest.id, key);
                  const prev = derived.previous ? rateFor(data.items, derived.previous.id, key) : null;
                  const delta = cur.rate !== null && prev?.rate != null ? cur.rate - prev.rate : null;
                  return (
                    <div key={key} className="bg-white border border-[rgba(74,78,85,0.12)] rounded-[8px] p-[24px] flex flex-col gap-2">
                      <p className="font-semibold leading-[44px] text-rust text-[36px]" style={wdth}>
                        {cur.rate === null ? '—' : `${Math.round(cur.rate)}%`}
                      </p>
                      <p className="font-medium leading-[24px] text-ink text-[15px]" style={wdth}>{m?.name ?? key}</p>
                      <p className="text-slate text-[12px] break-all" style={wdth}>{m?.modelId}</p>
                      <p className="text-slate text-[13px]" style={wdth}>
                        {cur.n ? `${Math.round((cur.rate! / 100) * cur.n)} of ${cur.n} answers` : 'waiting for results'}
                        {delta !== null && delta !== 0 ? ` · ${delta > 0 ? '+' : ''}${Math.round(delta)} pts vs last run` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question x model table */}
            <div className="flex flex-col gap-3">
              <p className="font-medium text-cloud text-[16px] tracking-[0.28px] uppercase" style={wdth}>By question</p>
              <div className="bg-white border border-[rgba(74,78,85,0.12)] rounded-[8px] overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="flex items-center px-[16px] py-[10px] border border-[rgba(74,78,85,0.15)]">
                    <p className={`${th} flex-1`} style={wdth}>Question</p>
                    {data.tracker.assistants.map((k) => (
                      <p key={k} className={`${th} w-[120px] shrink-0`} style={wdth}>{modelByKey(k)?.name.split(' ')[0] ?? k}</p>
                    ))}
                  </div>
                  {data.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className={`flex items-center px-[16px] py-[10px] border border-[rgba(74,78,85,0.08)] ${
                        idx % 2 ? 'bg-[rgba(237,238,241,0.5)]' : 'bg-white'
                      }`}
                    >
                      <p className="flex-1 font-medium leading-[20px] text-ink text-[14px] pr-4" style={wdth}>{q.question_text}</p>
                      {data.tracker.assistants.map((k) => {
                        const it = derived.latestItems.find((i) => i.question_id === q.id && i.assistant === k);
                        let dot: string = STATUS.neutral;
                        let label = '…';
                        if (it?.status === 'ok') {
                          dot = it.cited ? STATUS.pass : STATUS.fail;
                          label = it.cited ? 'Cited' : 'Not cited';
                        } else if (it?.status === 'unavailable') label = 'Unavailable';
                        return (
                          <div key={k} className="w-[120px] shrink-0 flex items-center gap-[6px]">
                            <Dot color={dot} />
                            {it?.cited && it.matched_url ? (
                              <a href={it.matched_url} target="_blank" rel="noreferrer" className="text-ink text-[13px] font-medium underline" style={wdth}>
                                {label}
                              </a>
                            ) : (
                              <span className="text-ink text-[13px] font-medium" style={wdth}>{label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Who gets cited instead */}
            {derived.topDomains.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="font-medium text-cloud text-[16px] tracking-[0.28px] uppercase" style={wdth}>
                  Who gets cited instead
                </p>
                <div className="bg-white border border-[rgba(74,78,85,0.12)] rounded-[8px] overflow-hidden">
                  {derived.topDomains.map(([domain, n], idx) => (
                    <div
                      key={domain}
                      className={`flex items-center justify-between px-[16px] py-[10px] border border-[rgba(74,78,85,0.08)] ${
                        idx % 2 ? 'bg-[rgba(237,238,241,0.5)]' : 'bg-white'
                      }`}
                    >
                      <p className="font-medium text-ink text-[14px]" style={wdth}>{domain}</p>
                      <p className="text-slate text-[13px]" style={wdth}>{n} answer{n === 1 ? '' : 's'}</p>
                    </div>
                  ))}
                </div>
                <p className="text-cloud/70 text-[13px]" style={wdth}>
                  Other sites the models cited for these same questions. Useful for seeing what content wins.
                </p>
              </div>
            )}

            {/* Run history */}
            <div className="flex flex-col gap-3">
              <p className="font-medium text-cloud text-[16px] tracking-[0.28px] uppercase" style={wdth}>Run history</p>
              <div className="bg-white border border-[rgba(74,78,85,0.12)] rounded-[8px] overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="flex items-center px-[16px] py-[10px] border border-[rgba(74,78,85,0.15)]">
                    <p className={`${th} w-[140px] shrink-0`} style={wdth}>Date</p>
                    {data.tracker.assistants.map((k) => (
                      <p key={k} className={`${th} flex-1`} style={wdth}>{modelByKey(k)?.name.split(' ')[0] ?? k}</p>
                    ))}
                  </div>
                  {data.runs.map((r, idx) => (
                    <div
                      key={r.id}
                      className={`flex items-center px-[16px] py-[10px] border border-[rgba(74,78,85,0.08)] ${
                        idx % 2 ? 'bg-[rgba(237,238,241,0.5)]' : 'bg-white'
                      }`}
                    >
                      <p className="w-[140px] shrink-0 font-medium text-ink text-[14px]" style={wdth}>
                        {fmtDate(r.created_at)}
                        {r.status === 'running' ? ' (running)' : ''}
                      </p>
                      {data.tracker.assistants.map((k) => {
                        const { rate } = rateFor(data.items, r.id, k);
                        return (
                          <p key={k} className="flex-1 text-ink text-[13px] font-medium" style={wdth}>
                            {rate === null ? '—' : `${Math.round(rate)}%`}
                          </p>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-cloud border border-rust rounded-lg p-6 flex flex-col gap-4">
              <p className="font-medium text-rust text-[14px] tracking-[0.28px] uppercase" style={wdth}>Manage this tracker</p>
              <Segmented
                value={data.tracker.frequency}
                onChange={(f) => act({ action: 'update', frequency: f })}
                options={[
                  { value: 'once', label: 'once' },
                  { value: 'weekly', label: 'weekly' },
                  { value: 'monthly', label: 'monthly' },
                ]}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={secondaryBtn}
                  style={wdth}
                  onClick={() => act({ action: 'update', active: !data.tracker.active })}
                >
                  {data.tracker.active ? 'pause' : 'resume'}
                </button>
                {!confirmDelete ? (
                  <button type="button" className={secondaryBtn} style={wdth} onClick={() => setConfirmDelete(true)}>
                    delete tracker
                  </button>
                ) : (
                  <button type="button" className={primaryBtn(false)} style={wdth} onClick={del}>
                    confirm delete (can’t be undone)
                  </button>
                )}
              </div>
              {error && <p className="text-[#a85c4a] text-[13px]" style={wdth}>{error}</p>}
            </div>
          </div>
        )}

        {!data && !error && (
          <p className="text-cloud text-[15px] mx-auto" style={wdth}>Loading…</p>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
