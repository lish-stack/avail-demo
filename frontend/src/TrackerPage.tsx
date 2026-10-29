import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dot,
  STATUS,
  labelCls,
  Segmented,
  SiteFooter,
  SiteHeader,
  SUPABASE_ANON_KEY,
  TRACKER_URL,
  Wordmark,
  primaryBtn,
  secondaryBtn,
  smallBtn,
  sectionTitleCls,
  FieldLabel,
  wdth,
} from './shared';
import { modelByKey } from './models';
import QuestionsField, { MAX_QUESTIONS } from './QuestionsField';

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

const th = labelCls;
const subhead = 'text-cloud text-[20px] tracking-[0.4px] uppercase font-normal';

export default function TrackerPage({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'report' | 'manage'>('report');
  const [draftText, setDraftText] = useState('');
  const [draftFreq, setDraftFreq] = useState<'once' | 'weekly' | 'monthly'>('weekly');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await call({ action: 'get', token }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data || dirty) return;
    setDraftText(data.questions.map((q) => q.question_text).join('\n'));
    setDraftFreq(data.tracker.frequency);
  }, [data, dirty]);

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

  async function save() {
    if (!data) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const lines = draftText.split('\n').map((l) => l.trim()).filter(Boolean);
      const res = await call({ token, action: 'update', frequency: draftFreq, questions: lines });
      setDirty(false);
      await load();
      setNotice(
        res.started
          ? 'Saved. We’re checking your updated list now. Switch to the report to watch results come in.'
          : res.skippedRun
            ? 'Saved. Your list will be checked on the next scheduled run.'
            : 'Saved.',
      );
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(false);
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
            <p className={sectionTitleCls} style={wdth}>
              Organization: <span className="font-medium text-rust">{data.tracker.orgName}</span>
            </p>

            {/* Private link note: plain text + small button, shown on both tabs */}
            <div className="flex flex-col items-start gap-3">
              <p className="text-cloud text-[15px] leading-[1.6]" style={wdth}>
                <span className="font-medium">This is a private link.</span> Anyone who has it can view this tracker, so
                bookmark it and share it only with people you trust.
              </p>
              <button type="button" onClick={copyLink} className={smallBtn} style={wdth}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-rust group-hover:text-cloud shrink-0" aria-hidden="true">
                  <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                {copied ? 'copied' : 'copy link'}
              </button>
            </div>

            <div className="flex">
              <Segmented
                onDark
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'report', label: 'report' },
                  { value: 'manage', label: 'manage tracking' },
                ]}
              />
            </div>

            {tab === 'report' && (
              <>
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
              <p className={subhead} style={wdth}>
                Cited directly, latest run{latest.status === 'running' ? ' (so far)' : ''}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {data.tracker.assistants.map((key) => {
                  const m = modelByKey(key);
                  const cur = rateFor(data.items, latest.id, key);
                  const prev = derived.previous ? rateFor(data.items, derived.previous.id, key) : null;
                  const delta = cur.rate !== null && prev?.rate != null ? cur.rate - prev.rate : null;
                  return (
                    <div key={key} className="bg-cloud border border-rust rounded-lg p-6 flex flex-col gap-2">
                      <p className="font-medium leading-[1.2] text-rust text-[28px] tracking-[0.56px]" style={wdth}>
                        {cur.rate === null ? '—' : `${Math.round(cur.rate)}%`}
                      </p>
                      <p className={labelCls} style={wdth}>{m?.name ?? key}</p>
                      <p className="text-slate text-[12px] break-all" style={wdth}>{m?.modelId}</p>
                      <p className="text-ink text-[14px] leading-[1.6]" style={wdth}>
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
              <p className={subhead} style={wdth}>By question</p>
              <div className="bg-cloud border border-rust rounded-lg overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="flex items-center px-4 py-3 border-b border-rust">
                    <p className={`${th} flex-1`} style={wdth}>Question</p>
                    {data.tracker.assistants.map((k) => (
                      <p key={k} className={`${th} w-[120px] shrink-0`} style={wdth}>{modelByKey(k)?.name.split(' ')[0] ?? k}</p>
                    ))}
                  </div>
                  <div className="divide-y divide-rust/40">
                    {data.questions.map((q) => (
                      <div key={q.id} className="flex items-center px-4 py-3">
                        <p className="flex-1 leading-[1.5] text-ink text-[14px] pr-4 font-normal" style={wdth}>{q.question_text}</p>
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
                                <a href={it.matched_url} target="_blank" rel="noreferrer" className="text-ink text-[13px] underline hover:text-rust" style={wdth}>
                                  {label}
                                </a>
                              ) : (
                                <span className="text-ink text-[13px]" style={wdth}>{label}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Who gets cited instead */}
            {derived.topDomains.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className={subhead} style={wdth}>Who gets cited instead</p>
                <div className="bg-cloud border border-rust rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-rust">
                    <p className={th} style={wdth}>Site</p>
                    <p className={th} style={wdth}>Answers</p>
                  </div>
                  <div className="divide-y divide-rust/40">
                    {derived.topDomains.map(([domain, n]) => (
                      <div key={domain} className="flex items-center justify-between px-4 py-3">
                        <p className="text-ink text-[14px] font-normal" style={wdth}>{domain}</p>
                        <p className="text-slate text-[14px]" style={wdth}>{n}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-cloud/70 text-[12px]" style={wdth}>
                  Other sites the models cited for these same questions. Useful for seeing what content wins.
                </p>
              </div>
            )}

            {/* Run history */}
            <div className="flex flex-col gap-3">
              <p className={subhead} style={wdth}>Run history</p>
              <div className="bg-cloud border border-rust rounded-lg overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="flex items-center px-4 py-3 border-b border-rust">
                    <p className={`${th} w-[140px] shrink-0`} style={wdth}>Date</p>
                    {data.tracker.assistants.map((k) => (
                      <p key={k} className={`${th} flex-1`} style={wdth}>{modelByKey(k)?.name.split(' ')[0] ?? k}</p>
                    ))}
                  </div>
                  <div className="divide-y divide-rust/40">
                    {data.runs.map((r) => (
                      <div key={r.id} className="flex items-center px-4 py-3">
                        <p className="w-[140px] shrink-0 text-ink text-[14px] font-normal" style={wdth}>
                          {fmtDate(r.created_at)}
                          {r.status === 'running' ? ' (running)' : ''}
                        </p>
                        {data.tracker.assistants.map((k) => {
                          const { rate } = rateFor(data.items, r.id, k);
                          return (
                            <p key={k} className="flex-1 text-ink text-[14px]" style={wdth}>
                              {rate === null ? '—' : `${Math.round(rate)}%`}
                            </p>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
              </>
            )}

            {tab === 'manage' && (
              <div className="flex flex-col gap-6 w-full">
                <p className="text-cloud/70 text-[14px] leading-[1.6]" style={wdth}>
                  {!data.tracker.active
                    ? 'This tracker is paused.'
                    : data.tracker.frequency === 'once'
                      ? 'One-time check: it won’t run again unless you change how often below.'
                      : data.tracker.nextRunAt
                        ? `Next scheduled run: ${fmtDate(data.tracker.nextRunAt)}.`
                        : ''}
                </p>

                <div className="flex flex-col gap-3 items-start w-full">
                  <FieldLabel>How often</FieldLabel>
                  <Segmented
                    size="secondary"
                    onDark
                    value={draftFreq}
                    onChange={(f) => { setDraftFreq(f); setDirty(true); }}
                    options={[
                      { value: 'once', label: 'once' },
                      { value: 'weekly', label: 'weekly' },
                      { value: 'monthly', label: 'monthly' },
                    ]}
                  />
                </div>

                <div className="w-full">
                  <QuestionsField
                    onDark
                    text={draftText}
                    setText={(t) => { setDraftText(t); setDirty(true); }}
                  />
                </div>

                <div className="flex flex-col items-start gap-3">
                  <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || saving || draftText.split('\n').filter((l) => l.trim()).length === 0 ||
                      draftText.split('\n').filter((l) => l.trim()).length > MAX_QUESTIONS}
                    className={primaryBtn(!dirty || saving)}
                    style={wdth}
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <p className="text-cloud/70 text-[12px] leading-[1.6]" style={wdth}>
                    Adding new questions starts a fresh check of your whole list. Removed questions stay in past runs.
                  </p>
                  {notice && <p className="text-cloud text-[14px]" style={wdth}>{notice}</p>}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={smallBtn}
                    style={wdth}
                    onClick={() => act({ action: 'update', active: !data.tracker.active })}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-rust group-hover:text-cloud shrink-0" aria-hidden="true">
                      {data.tracker.active ? (
                        <path d="M5.5 3v10M10.5 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      ) : (
                        <path d="M5 3l8 5-8 5V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      )}
                    </svg>
                    {data.tracker.active ? 'pause' : 'resume'}
                  </button>
                  <button
                    type="button"
                    className={confirmDelete ? `${smallBtn} !bg-[#a85c4a] !border-[#a85c4a] !text-white` : smallBtn}
                    style={wdth}
                    onClick={confirmDelete ? del : () => setConfirmDelete(true)}
                  >
                    <svg
                      width="14" height="14" viewBox="0 0 16 16" fill="none"
                      className={`shrink-0 ${confirmDelete ? 'text-white' : 'text-rust group-hover:text-cloud'}`}
                      aria-hidden="true"
                    >
                      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5M6.8 7v4M9.2 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {confirmDelete ? 'confirm delete (can’t be undone)' : 'delete tracker'}
                  </button>
                </div>
                {error && <p className="text-[#e0846f] text-[13px]" style={wdth}>{error}</p>}
              </div>
            )}
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
