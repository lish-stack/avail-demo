import { useRef, useState } from 'react';
import {
  Dropdown,
  FieldLabel,
  ORGS,
  Segmented,
  SUPABASE_ANON_KEY,
  TRACKER_URL,
  apiOrgName,
  primaryBtn,
  secondaryBtn,
  wdth,
} from './shared';
import { MODELS } from './models';

const MAX_QUESTIONS = 25;
const OTHER = "My organization isn't listed";

// Minimal CSV reader: first column only, handles quoted fields, skips a header row.
function parseCsvFirstColumn(text: string): string[] {
  const rows: string[] = [];
  let field = '';
  let inQuotes = false;
  let firstCol: string | null = null;
  const pushRow = () => {
    if (firstCol === null) firstCol = field;
    rows.push((firstCol ?? '').trim());
    field = '';
    firstCol = null;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { if (firstCol === null) firstCol = field; field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else field += ch;
  }
  if (field || firstCol !== null) pushRow();
  const cleaned = rows.filter(Boolean);
  if (cleaned.length && /^(questions?|prompts?)$/i.test(cleaned[0])) cleaned.shift();
  return cleaned;
}

export default function TrackForm() {
  const [orgChoice, setOrgChoice] = useState(ORGS[0]);
  const [customOrg, setCustomOrg] = useState('');
  const [domains, setDomains] = useState('');
  const [text, setText] = useState('');
  const [frequency, setFrequency] = useState<'once' | 'weekly' | 'monthly'>('weekly');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOther = orgChoice === OTHER;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const count = lines.length;
  const orgReady = isOther ? customOrg.trim() && domains.trim() : true;
  const ready = count > 0 && count <= MAX_QUESTIONS && !!orgReady && !busy;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const qs = parseCsvFirstColumn(String(reader.result ?? ''));
      setText(qs.join('\n'));
      setError(null);
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  function downloadTemplate() {
    const csv = 'question\n"Is PETA a legitimate charity?"\n"Can insects feel pain?"\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'avail-question-list-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(TRACKER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          action: 'create',
          orgName: isOther ? customOrg.trim() : apiOrgName(orgChoice),
          domains: isOther ? domains.split(/[,\s]+/).filter(Boolean) : undefined,
          questions: lines,
          frequency,
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }
      window.location.assign(`/t/${data.token}`);
    } catch {
      setError("Couldn't reach the demo server. Please try again in a moment.");
      setBusy(false);
    }
  }

  const inputCls =
    'bg-white border border-solid border-slate/55 rounded h-[45px] w-full px-4 text-[16px] outline-none focus:border-[#c97c2e]';

  return (
    <>
      <p className="font-medium text-slate text-[16px] text-center tracking-[-0.08px] leading-[1.6]" style={wdth}>
        Save a list of questions and we’ll check them for you on a schedule. Each run asks{' '}
        {MODELS.map((m) => m.name).join(', ')}, and reports whether each answer cites your organization’s own website.
      </p>

      <div className="flex flex-col gap-2 items-start w-full">
        <FieldLabel>Organization</FieldLabel>
        <Dropdown value={orgChoice} options={[...ORGS, OTHER]} onSelect={setOrgChoice} />
        {isOther && (
          <div className="flex flex-col gap-2 w-full">
            <input
              className={inputCls}
              style={wdth}
              placeholder="Organization name"
              value={customOrg}
              maxLength={80}
              onChange={(e) => setCustomOrg(e.target.value)}
            />
            <input
              className={inputCls}
              style={wdth}
              placeholder="Your website domain(s), e.g. example.org"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 items-start w-full">
        <FieldLabel>Questions</FieldLabel>
        <div
          className={`bg-white border border-solid rounded w-full p-4 ${text ? 'border-[#c97c2e]' : 'border-slate/55'}`}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'One question per line, or upload a CSV.\nExample: Is Vegan Outreach a good charity to donate to?'}
            className="w-full h-[160px] resize-none border-none outline-none text-[15px] placeholder:text-slate/55 bg-transparent"
            style={wdth}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex flex-wrap gap-3 items-center">
            <button type="button" className={secondaryBtn} style={wdth} onClick={() => fileRef.current?.click()}>
              upload csv
            </button>
            <button type="button" className="text-[13px] text-slate underline" style={wdth} onClick={downloadTemplate}>
              download template
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </div>
          <p className={`text-[12px] ${count > MAX_QUESTIONS ? 'text-[#a85c4a] font-medium' : 'text-slate/55'}`} style={wdth}>
            {count} / {MAX_QUESTIONS}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 items-start w-full">
        <FieldLabel>How often</FieldLabel>
        <Segmented
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: 'once', label: 'once' },
            { value: 'weekly', label: 'weekly' },
            { value: 'monthly', label: 'monthly' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2 items-start w-full">
        <FieldLabel>Email (optional)</FieldLabel>
        <input
          className={inputCls}
          style={wdth}
          type="email"
          placeholder="For weekly reports (coming soon)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button type="button" onClick={start} disabled={!ready} className={primaryBtn(!ready)} style={wdth}>
        {busy ? 'Setting up…' : 'Start tracking'}
      </button>

      {error && (
        <div className="bg-white border border-[#a85c4a]/40 rounded p-4 w-full text-[#a85c4a] text-[14px] text-center">
          {error}
        </div>
      )}

      <p className="text-[12px] text-slate/55 text-center" style={wdth}>
        Free during the research preview. Up to {MAX_QUESTIONS} questions per list. You’ll get a private link to your
        results; anyone who has it can view them.
      </p>
    </>
  );
}
