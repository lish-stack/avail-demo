import { useState } from 'react';
import {
  Dropdown,
  FieldLabel,
  ORGS,
  Segmented,
  SUPABASE_ANON_KEY,
  TRACKER_URL,
  apiOrgName,
  primaryBtn,
  wdth,
} from './shared';
import { MODELS } from './models';
import QuestionsField, { MAX_QUESTIONS } from './QuestionsField';

const OTHER = "My organization isn't listed";

export default function TrackForm() {
  const [orgChoice, setOrgChoice] = useState(ORGS[0]);
  const [customOrg, setCustomOrg] = useState('');
  const [domains, setDomains] = useState('');
  const [text, setText] = useState('');
  const [frequency, setFrequency] = useState<'once' | 'weekly' | 'monthly'>('weekly');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOther = orgChoice === OTHER;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const count = lines.length;
  const orgReady = isOther ? customOrg.trim() && domains.trim() : true;
  const ready = count > 0 && count <= MAX_QUESTIONS && !!orgReady && !busy;

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
    'bg-white border border-solid border-slate/55 rounded h-[45px] w-full px-4 text-[15px] outline-none focus:border-[#c97c2e]';

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

      <QuestionsField text={text} setText={setText} />

      <div className="flex flex-col gap-3 items-start w-full">
        <FieldLabel>How often</FieldLabel>
        <Segmented
          size="secondary"
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
        <FieldLabel>
          Email <span className="normal-case font-normal text-slate tracking-normal">(optional)</span>
        </FieldLabel>
        <p className="text-[12px] leading-[1.6] text-slate/55" style={wdth}>
          We’ll send you a link to your citation tracking report in the next few minutes, and a reminder to check it
          when it updates (if you selected the weekly or monthly tracking option).
        </p>
        <input
          className={inputCls}
          style={wdth}
          type="email"
          placeholder="you@example.org"
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
        Free during the research preview. Up to {MAX_QUESTIONS} questions per list.
        <br />
        You’ll get a private link to your results; anyone who has it can view them.
      </p>
    </>
  );
}
