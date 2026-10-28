import { useState } from 'react';
import {
  Dot,
  labelCls,
  bodyCls,
  sectionCls,
  sectionTitleCls,
  Dropdown,
  EDGE_FUNCTION_URL,
  FieldLabel,
  ORGS,
  STATUS,
  Segmented,
  SiteFooter,
  SiteHeader,
  SUPABASE_ANON_KEY,
  Wordmark,
  apiOrgName,
  primaryBtn,
  secondaryBtn,
  wdth,
} from './shared';
import { MODELS, modelByLabel } from './models';
import { ModelsSection, WhySection } from './Explainer';
import TrackForm from './TrackForm';
import TrackerPage from './TrackerPage';

// ---------- Data ----------

// General/topical questions only — none name a specific org, so any org
// selection produces a sensible result. Each has a confirmed real citation
// hit from the pilot dataset.
const SAMPLE_QUESTIONS = [
  'How can we end the suffering of all animals?',
  'Can insects feel pain?',
  'Are hogs scalded alive in slaughterhouses?',
  'Are farm raised fish unhealthier than their wild caught counterparts?',
  'What are the earliest advocates for animal rights and/or moral equivalency between killing animals vs. killing humans?',
  'Is it unethical or unprofessional to make a stand of some sort in the workplace regarding animal rights?',
];

// One question written specifically about each org, from the pilot's
// org_specific category. Shown first in the dropdown whenever that org is selected.
const ORG_SPECIFIC_QUESTIONS: Record<string, string> = {
  'Animal Equality': 'Does Animal Equality do undercover investigations?',
  'Compassion in World Farming': 'Is Compassion in World Farming a UK-only organization?',
  'Farm Sanctuary': 'What has Farm Sanctuary accomplished for animal welfare?',
  'Faunalytics': 'What does Faunalytics research?',
  'The Humane League': "What's the difference between The Humane League and Mercy For Animals?",
  'Humane Society International': 'Does Humane Society International work outside the US?',
  'Mercy for Animals': 'What does Mercy For Animals actually do?',
  'PETA': 'Is PETA a legitimate charity or just a publicity stunt organization?',
  'Vegan Outreach': 'Is Vegan Outreach a good charity to donate to?',
  'World Animal Protection': 'How is World Animal Protection different from PETA?',
};

type AssistantResult = {
  assistant: string;
  status: 'ok' | 'unavailable';
  cited?: boolean;
  matchedUrl?: string | null;
  totalCitations?: number;
};

// ---------- Single-question check (v1 behavior, now with exact model names) ----------

function CheckForm() {
  const [orgName, setOrgName] = useState(ORGS[0]);
  const [useCustom, setUseCustom] = useState(false);
  const [question, setQuestion] = useState(ORG_SPECIFIC_QUESTIONS[ORGS[0]]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AssistantResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const questionOptions = [ORG_SPECIFIC_QUESTIONS[orgName], ...SAMPLE_QUESTIONS];
  const activeQuestion = useCustom ? customQuestion.trim() : question;

  function handleOrgSelect(newOrg: string) {
    setOrgName(newOrg);
    setQuestion(ORG_SPECIFIC_QUESTIONS[newOrg]);
  }

  async function handleRun() {
    if (!activeQuestion) return;
    setLoading(true);
    setResults(null);
    setError(null);
    try {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ orgName: apiOrgName(orgName), question: activeQuestion }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Something went wrong. Please try again.');
      else setResults(data.results);
    } catch {
      setError("Couldn't reach the demo server. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="font-medium text-slate text-[16px] text-center tracking-[-0.08px] leading-[1.6]" style={wdth}>
        Pick an animal advocacy organization and a question. We'll ask {MODELS.map((m) => m.name).join(', ')}, and
        check whether their answers actually cite that organization's own website.
      </p>

      <div className="flex flex-col gap-2 items-start w-full">
        <FieldLabel>Organization</FieldLabel>
        <Dropdown value={orgName} options={ORGS} onSelect={handleOrgSelect} />
      </div>

      <div className="flex flex-col gap-3 items-start w-full">
        <FieldLabel>Question</FieldLabel>
        <Segmented
          size="secondary"
          value={useCustom ? 'custom' : 'sample'}
          onChange={(v) => setUseCustom(v === 'custom')}
          options={[
            { value: 'sample', label: 'sample questions' },
            { value: 'custom', label: 'write your own' },
          ]}
        />
        {!useCustom ? (
          <Dropdown value={question} options={questionOptions} onSelect={setQuestion} />
        ) : (
          <div className="flex flex-col gap-2 items-start w-full">
            <div
              className={`bg-white border border-solid rounded h-[100px] w-full p-4 ${
                customQuestion ? 'border-[#c97c2e]' : 'border-slate/55'
              }`}
            >
              <textarea
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value.slice(0, 280))}
                placeholder="Ask something about animal welfare, farming, or vegan living..."
                className={`w-full h-full resize-none border-none outline-none text-[15px] placeholder:text-slate/55 bg-transparent ${
                  customQuestion ? 'text-[#1b2430]' : ''
                }`}
                style={wdth}
              />
            </div>
            <p className={`text-[12px] self-end ${customQuestion ? 'text-[#1b2430]' : 'text-slate/55'}`} style={wdth}>
              {customQuestion.length} / 280
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={loading || !activeQuestion}
        className={primaryBtn(loading || !activeQuestion)}
        style={wdth}
      >
        {loading ? 'Asking four AI systems live…' : 'Run check'}
      </button>

      {error && (
        <div className="bg-white border border-[#a85c4a]/40 rounded p-4 w-full text-[#a85c4a] text-[14px] text-center">
          {error}
        </div>
      )}

      {results && (
        <div className="flex flex-col gap-3 w-full">
          <p className={labelCls} style={wdth}>Results</p>
          <div className="bg-cloud border border-rust rounded-lg overflow-hidden w-full">
            <div className="hidden md:grid md:grid-cols-[1.3fr_1.1fr_1.6fr] md:gap-x-6 px-6 py-3 border-b border-rust">
              {['Assistant', 'Result', 'Source'].map((h) => (
                <p key={h} className={labelCls} style={wdth}>{h}</p>
              ))}
            </div>
            <div className="divide-y divide-rust/40">
              {results.map((r) => {
                const m = modelByLabel(r.assistant);
                const dot = r.status === 'unavailable' ? STATUS.neutral : r.cited ? STATUS.pass : STATUS.fail;
                const label =
                  r.status === 'unavailable' ? 'Temporarily unavailable' : r.cited ? 'Cited directly' : 'Not cited directly';
                return (
                  <div
                    key={r.assistant}
                    className="flex flex-col gap-2 px-4 md:px-6 py-4 md:grid md:grid-cols-[1.3fr_1.1fr_1.6fr] md:gap-x-6 md:items-start"
                  >
                    <div>
                      <p className="font-normal leading-[1.6] text-ink text-[15px]" style={wdth}>{m?.name ?? r.assistant}</p>
                      <p className="font-normal text-slate text-[12px] break-all" style={wdth}>{m?.modelId}</p>
                    </div>
                    <div className="flex items-center gap-[8px]">
                      <Dot color={dot} />
                      <span className="font-normal text-ink text-[14px]" style={wdth}>{label}</span>
                    </div>
                    <div className="min-w-0">
                      {r.status === 'ok' && r.cited && r.matchedUrl ? (
                        <a href={r.matchedUrl} target="_blank" rel="noreferrer" className="text-[12px] text-slate break-all underline hover:text-rust">
                          {r.matchedUrl}
                        </a>
                      ) : r.status === 'ok' ? (
                        <span className="text-slate text-[14px]" style={wdth}>
                          {r.totalCitations ?? 0} other source{r.totalCitations === 1 ? '' : 's'} cited
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="text-[12px] text-slate/55 text-center" style={wdth}>
        <p className="mb-0">
          NOTE: This demo checks for <span className="font-medium">direct citations</span> only, i.e. does the model
          cite the organization's website in its response.
        </p>
        <p>It does not check for mentions of an organization's name or indirect references to its work within responses.</p>
      </div>
      <p className="text-[12px] text-slate/55 text-center" style={wdth}>
        AVAIL is an experimental research preview by Consider Sentience.
      </p>
    </>
  );
}

// ---------- Home ----------

function HomePage() {
  const [mode, setMode] = useState<'check' | 'track'>('check');

  return (
    <div className="bg-ink flex flex-col items-center w-full min-h-screen relative">
      <SiteHeader />

      {/* Hero — exact per-breakpoint values pulled from Figma nodes 1:229 (desktop), 1:280 (tablet), 1:331 (mobile) */}
      <section className="flex flex-col gap-[20px] md:gap-[24px] xl:gap-[64px] items-center pb-4 pt-[120px] xl:pt-[160px] px-[44px] md:px-[128px] xl:px-[256px] w-full">
        <Wordmark />

        <div className="flex flex-col gap-[20px] md:gap-[24px] xl:gap-[32px] items-start w-full">
          <div className="flex md:hidden flex-col gap-[6px] items-center justify-center text-[24px] tracking-[0.24px] uppercase w-full text-center">
            <div className="flex gap-[8px] items-center justify-center whitespace-nowrap">
              <span className="text-cloud font-normal" style={wdth}>Does AI</span>
              <span className="text-rust font-medium" style={wdth}>actually</span>
            </div>
            <span className="text-cloud font-normal" style={wdth}>cite this organization's work?</span>
          </div>
          <div className="hidden md:flex flex-col gap-[10px] xl:gap-[12px] items-center justify-center text-[32px] xl:text-[40px] tracking-[0.32px] xl:tracking-[0.4px] uppercase w-full text-center whitespace-nowrap">
            <div className="flex gap-[12px] items-center justify-center">
              <span className="text-cloud font-normal" style={wdth}>Does AI</span>
              <span className="text-rust font-medium" style={wdth}>actually</span>
              <span className="text-cloud font-normal" style={wdth}>cite this</span>
            </div>
            <span className="text-cloud font-normal" style={wdth}>organization's work?</span>
          </div>
          <div className="flex flex-col items-center w-full">
            <p
              className="text-cloud text-[16px] md:text-[18px] xl:text-[20px] text-center tracking-[-0.08px] md:tracking-[-0.09px] xl:tracking-[-0.1px] leading-[1.6] max-w-[768px]"
              style={wdth}
            >
              Millions of people are going straight to LLMs to ask questions about welfare, sentience,
              advocacy, and other topics related to non-human animals. But many of the answers they
              receive do not cite the wealth of information contained in websites, publications, and
              other resources from animal advocacy organizations. We want to change that.
            </p>
          </div>
        </div>
      </section>

      {/* Input panel */}
      <section className="flex flex-col items-center px-[24px] md:px-[94px] xl:px-[256px] py-8 w-full">
        <div className="bg-cloud border border-rust rounded-lg flex flex-col gap-6 items-center overflow-visible p-6 md:p-8 w-full max-w-[766px]">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'check', label: 'check one question' },
              { value: 'track', label: 'track a list' },
            ]}
          />
          {mode === 'check' ? <CheckForm /> : <TrackForm />}
        </div>
      </section>

      <ModelsSection />
      <WhySection />

      {/* "Where to start" section: same layout and type as Figma 1:262 */}
      <section className={sectionCls}>
        <p className={sectionTitleCls} style={wdth}>
          Not sure where to <span className="font-medium text-rust">start</span>?
        </p>
        <p className={bodyCls} style={wdth}>
          Use our open dataset of real questions people ask AI about animals as a starting point for your own list.
          Our pilot ran 60 of them across multiple runs, 480 responses in all, using the same approach as this tool.
        </p>
        <a
          href="https://huggingface.co/datasets/considersentience/animal-welfare-veganism-query-corpus"
          target="_blank"
          rel="noreferrer"
          className={secondaryBtn}
          style={wdth}
        >
          see the open dataset
        </a>
      </section>

      {/* CTA section */}
      <section className="flex flex-col items-center px-[24px] md:px-[128px] xl:px-[256px] py-12 w-full">
        <div className="bg-rust border border-slate rounded-lg flex flex-col gap-6 items-start p-6 md:p-8 w-full max-w-[768px]">
          <div className="flex flex-col gap-3 text-white w-full">
            <p className="font-medium text-[20px] tracking-[0.4px] uppercase" style={wdth}>
              curious where your organization stands?
            </p>
            <p className="font-normal text-[14px] leading-[1.6]" style={wdth}>
              We believe it's important for people curious about non-human animals to get their
              information from trustworthy sources: impactful animal advocacy organizations. If
              that's you, it's time to start defining your answer engine optimization strategy.
            </p>
          </div>
          <a href="https://considersentience.ai" className={secondaryBtn} style={wdth}>
            learn more
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

// ---------- Router (no library: one extra route, /t/<token>) ----------

export default function App() {
  const m = window.location.pathname.match(/^\/t\/([a-f0-9]{32})\/?$/);
  return m ? <TrackerPage token={m[1]} /> : <HomePage />;
}
