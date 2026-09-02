import { useState, useRef, useEffect } from 'react';

// ---------- Data ----------

const ORGS = [
  'Animal Equality',
  'Compassion in World Farming',
  'Farm Sanctuary',
  'Faunalytics',
  'The Humane League',
  'Humane Society International',
  'Mercy for Animals',
  'PETA',
  'Vegan Outreach',
  'World Animal Protection',
];

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
// org_specific category. Shown first in the dropdown whenever that org is
// selected, so trying "your own org's question" is easy to find.
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

const wdth = { fontVariationSettings: '"wdth" 100' } as const;

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ---------- Reusable dropdown (default / focus / hover states from Figma) ----------

function Dropdown({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex flex-col gap-[2px] items-start relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`bg-white border border-solid flex h-[45px] items-center justify-between px-4 py-3 rounded w-full ${
          open ? 'border-[#c97c2e]' : 'border-[rgba(74,78,85,0.55)]'
        }`}
      >
        <p
          className="flex-1 font-normal text-[#1a1c1e] text-[16px] text-ellipsis text-left overflow-hidden whitespace-nowrap"
          style={wdth}
        >
          {value}
        </p>
        <div className={`shrink-0 size-4 flex items-center justify-center ${open ? '-scale-y-100' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="#1a1c1e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="flex flex-col items-start overflow-hidden rounded relative shrink-0 w-full drop-shadow-[0px_0px_12px_rgba(0,0,0,0.2)] z-20">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onSelect(opt);
                setOpen(false);
              }}
              className="bg-white hover:bg-cloud flex flex-col h-[52px] items-start justify-center px-3 w-full text-left"
            >
              <p className="font-normal text-[16px] text-black" style={wdth}>
                {opt}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Main app ----------

export default function App() {
  const [orgName, setOrgName] = useState(ORGS[0]);
  const [useCustom, setUseCustom] = useState(false);
  const [question, setQuestion] = useState(ORG_SPECIFIC_QUESTIONS[ORGS[0]]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AssistantResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Question list is dynamic: the selected org's own question appears first,
  // followed by the general/topical questions (which work with any org).
  const questionOptions = [ORG_SPECIFIC_QUESTIONS[orgName], ...SAMPLE_QUESTIONS];

  const activeQuestion = useCustom ? customQuestion.trim() : question;

  function handleOrgSelect(newOrg: string) {
    setOrgName(newOrg);
    // Default to the new org's own question, so switching orgs shows a
    // sensible pairing rather than leaving a mismatched question selected.
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
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ orgName, question: activeQuestion }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
      } else {
        setResults(data.results);
      }
    } catch {
      setError("Couldn't reach the demo server. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-ink flex flex-col items-center w-full min-h-screen">
      {/* Header */}
      <header className="bg-ink flex flex-col gap-2 items-start justify-center p-4 w-full">
        <a href="https://considersentience.ai" className="h-8 block">
          {/* Replace /logo.svg with the real exported asset — see SETUP.md */}
          <img src="/logo.svg" alt="Consider Sentience" className="h-8" />
        </a>
        <a href="https://considersentience.ai" className="group relative block h-[21px]">
          {/* Default state — exact port of Figma node 4:202 */}
          <div
            className="group-hover:hidden [word-break:break-word] content-stretch flex gap-[5px] items-center justify-center leading-[0] relative text-[#edeef1] text-center w-[127px] whitespace-nowrap"
          >
            <div className="capitalize flex flex-col font-['Nunito'] font-extralight justify-center relative shrink-0 text-[20px]">
              <p className="leading-none">[</p>
            </div>
            <div className="flex flex-col font-normal justify-center relative shrink-0 text-[14px]" style={wdth}>
              <p className="leading-[1.5]">return to site</p>
            </div>
            <div className="capitalize flex flex-col font-['Nunito'] font-extralight justify-center relative shrink-0 text-[20px]">
              <p className="leading-none">]</p>
            </div>
          </div>

          {/* Hover state — exact port of Figma node 4:206, no width constraint (matches source) */}
          <div className="hidden group-hover:flex gap-[5px] items-center justify-center relative absolute top-0 left-0">
            <div className="flex flex-row items-center self-stretch">
              <div className="content-stretch flex h-full items-center justify-end relative shrink-0 w-[8px]">
                <div className="relative shrink-0 size-[4px] rounded-full bg-[rgba(201,124,46,0.7)]" />
              </div>
            </div>
            <div className="[word-break:break-word] capitalize flex flex-col font-['Nunito'] font-light justify-center leading-[0] relative shrink-0 text-[20px] text-[rgba(201,124,46,0.7)] text-center whitespace-nowrap">
              <p className="leading-none">[</p>
            </div>
            <div className="[word-break:break-word] flex flex-col font-['Source_Serif_4'] font-medium italic justify-center leading-[0] relative shrink-0 text-[#edeef1] text-[14px] text-center whitespace-nowrap">
              <p className="leading-[1.5]">return to site</p>
            </div>
            <div className="[word-break:break-word] capitalize flex flex-col font-['Nunito'] font-light justify-center leading-[0] relative shrink-0 text-[20px] text-[rgba(201,124,46,0.7)] text-center whitespace-nowrap">
              <p className="leading-none">]</p>
            </div>
            <div className="flex flex-row items-center self-stretch">
              <div className="content-stretch flex h-full items-center relative shrink-0">
                <div className="content-stretch flex h-full items-center relative shrink-0">
                  <div className="relative shrink-0 size-[6px] rounded-full bg-[rgba(201,124,46,0.7)]" />
                </div>
              </div>
            </div>
          </div>
        </a>
      </header>

      {/* Hero — exact per-breakpoint values pulled from Figma nodes 1:229 (desktop), 1:280 (tablet), 1:331 (mobile) */}
      <section className="flex flex-col gap-[20px] md:gap-[24px] xl:gap-[64px] items-center pb-4 pt-[120px] xl:pt-[160px] px-[44px] md:px-[128px] xl:px-[256px] w-full">
        <div className="flex flex-col gap-4 items-center">
          <div className="flex flex-col gap-1 items-center">
            <div className="flex gap-[2px] items-center justify-center">
              {['a', 'v', 'a', 'i', 'l'].map((ch, i) => (
                <span key={i} className="flex items-center">
                  <span className="font-semibold text-cloud text-[24px] tracking-[0.48px] uppercase" style={wdth}>
                    {ch}
                  </span>
                  {i < 4 && <span className="size-1 rounded-full bg-cloud inline-block mx-[2px]" />}
                </span>
              ))}
            </div>
            <p className="font-medium text-cloud text-[16px] tracking-[0.32px] uppercase" style={wdth}>
              animal visibility ai landscape
            </p>
          </div>
          <div className="flex gap-[6px] items-center">
            <span className="font-['Nunito'] text-rust text-[20px] tracking-[-0.4px]">[</span>
            <span className="font-['Source_Serif_4'] italic font-medium text-white/70 text-[14px] tracking-[-0.28px]">
              a project from
            </span>
            <a href="https://considersentience.ai" className="h-5 block">
              <img src="/logo.svg" alt="Consider Sentience" className="h-5" />
            </a>
            <span className="font-['Nunito'] text-rust text-[20px] tracking-[-0.4px]">]</span>
          </div>
        </div>

        <div className="flex flex-col gap-[20px] md:gap-[24px] xl:gap-[32px] items-start w-full">
          {/* Mobile heading (1:352) — wraps differently from tablet/desktop, not just smaller text */}
          <div className="flex md:hidden flex-col gap-[6px] items-center justify-center text-[24px] tracking-[0.24px] uppercase w-full text-center">
            <div className="flex gap-[8px] items-center justify-center whitespace-nowrap">
              <span className="text-cloud font-normal" style={wdth}>Does AI</span>
              <span className="text-rust font-medium" style={wdth}>actually</span>
            </div>
            <span className="text-cloud font-normal" style={wdth}>cite this organization's work?</span>
          </div>
          {/* Tablet (1:301) / Desktop (1:250) heading — same structure, different scale */}
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

      {/* Input panel — results render INSIDE this same panel, appended below the button/note area */}
      <section className="flex flex-col items-center px-[24px] md:px-[94px] xl:px-[256px] py-8 w-full">
        <div className="bg-cloud border border-rust rounded-lg flex flex-col gap-6 items-center overflow-visible p-6 md:p-8 w-full max-w-[766px]">
          <p className="font-medium text-slate text-[16px] text-center tracking-[-0.08px] leading-[1.6]" style={wdth}>
            Pick an animal advocacy organization and a question. We'll ask Claude, Perplexity,
            ChatGPT, and Llama 3.3 (an open-weight model, via Together AI), and check whether their
            answers actually cite that organization's own website.
          </p>

          {/* Organization */}
          <div className="flex flex-col gap-2 items-start w-full">
            <p className="font-medium text-rust text-[14px] tracking-[0.28px] uppercase" style={wdth}>
              Organization
            </p>
            <Dropdown value={orgName} options={ORGS} onSelect={handleOrgSelect} />
          </div>

          {/* Question */}
          <div className="flex flex-col gap-3 items-start w-full">
            <p className="font-medium text-rust text-[14px] tracking-[0.28px] uppercase" style={wdth}>
              Question
            </p>

            <div className="border border-ink/55 rounded-full flex items-center p-[6px]">
              <button
                type="button"
                onClick={() => setUseCustom(false)}
                className={`rounded-full px-3 py-2 text-[12px] uppercase transition-colors ${
                  !useCustom ? 'bg-ink text-white font-medium' : 'text-ink font-normal'
                }`}
                style={wdth}
              >
                sample questions
              </button>
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`rounded-full px-3 py-2 text-[12px] uppercase transition-colors ${
                  useCustom ? 'bg-ink text-white font-medium' : 'text-ink font-normal'
                }`}
                style={wdth}
              >
                write your own
              </button>
            </div>

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

          {/* Run button — mobile uses the dedicated "AVAIL Primary button - mobile" instance
              override (px-14/py-10/text-14), confirmed on the actual placed Mobile instance
              (node 1:362), not just the abstract component definition */}
          <button
            type="button"
            onClick={handleRun}
            disabled={loading || !activeQuestion}
            className={`rounded-full px-[14px] py-[10px] md:px-4 md:py-3 text-[14px] md:text-[16px] tracking-[0.28px] md:tracking-[0.32px] uppercase transition-colors ${
              loading || !activeQuestion
                ? 'bg-slate/40 text-white cursor-default'
                : 'bg-rust text-cloud cursor-pointer hover:bg-[#1b2430]'
            }`}
            style={wdth}
          >
            {loading ? 'Asking four AI systems live…' : 'Run check'}
          </button>

          {/* Error state — inside the panel */}
          {error && (
            <div className="bg-[#FDECEA] border border-[#f5c6c0] rounded p-4 w-full text-[#A12B1F] text-[14px] text-center">
              {error}
            </div>
          )}

          {/* Results — inside the panel, per feedback */}
          {results && (
            <div className="flex flex-col gap-4 w-full">
              <p className="font-medium text-ink text-[16px] tracking-[0.28px] uppercase" style={wdth}>
                Results
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {results.map((r) => (
                  <div
                    key={r.assistant}
                    className={`rounded border p-4 ${
                      r.status === 'ok' && r.cited
                        ? 'bg-[#F3F9EE] border-[#c7e3b5]'
                        : 'bg-white border-slate/20'
                    }`}
                  >
                    <p className="font-semibold text-[15px] mb-2" style={wdth}>{r.assistant}</p>
                    {r.status === 'unavailable' ? (
                      <p className="text-slate text-[14px]" style={wdth}>Temporarily unavailable</p>
                    ) : r.cited ? (
                      <>
                        <p className="text-[#3A7D2C] font-semibold text-[14px] mb-1" style={wdth}>✅ Cited directly</p>
                        <a
                          href={r.matchedUrl ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-slate break-all underline"
                        >
                          {r.matchedUrl}
                        </a>
                      </>
                    ) : (
                      <p className="text-slate text-[14px]" style={wdth}>
                        ❌ Not cited directly ({r.totalCitations ?? 0} other source{r.totalCitations === 1 ? '' : 's'} used)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="text-[12px] text-slate/55 text-center" style={wdth}>
            <p className="mb-0">
              NOTE: This demo checks for <span className="font-medium">direct citations</span> only,
              i.e. does the model cite the organization's website in its response.
            </p>
            <p>It does not check for mentions of an organization's name or indirect references to its work within responses.</p>
          </div>
          <p className="text-[12px] text-slate/55 text-center" style={wdth}>
            AVAIL is an experimental research preview by Consider Sentience.
          </p>
        </div>
      </section>

      {/* Credibility section — exact values from Figma nodes 1:262 (desktop/tablet), 1:363 (mobile) */}
      <section className="flex flex-col gap-4 items-start px-[24px] md:px-[128px] xl:px-[256px] py-8 w-full">
        <p className="text-[20px] md:text-[28px] tracking-[0.4px] md:tracking-[0.56px] uppercase text-cloud" style={wdth}>
          <span className="font-normal">This demo is </span>
          <span className="text-rust">one query</span>
          <span className="font-normal">. </span>
          <span className="font-normal">Our pilot ran</span>
          <span className="text-rust"> 480</span>
          <span>.</span>
        </p>
        <p className="text-cloud text-[15px] leading-[1.6]" style={wdth}>
          We evaluated major conversational systems using a diverse set of 60 core animal protection
          questions across multiple runs. This live demo uses the exact same pipeline to verify
          real-time citations.
        </p>
        <a
          href="https://huggingface.co/datasets/considersentience/animal-welfare-veganism-query-corpus"
          target="_blank"
          rel="noreferrer"
          className="bg-cloud border border-slate rounded-full px-[14px] py-[10px] md:px-4 md:py-3 text-[14px] md:text-[16px] uppercase tracking-[0.28px] md:tracking-[0.32px] text-ink hover:bg-[#4a4e55] hover:text-cloud transition-colors"
          style={wdth}
        >
          see the open dataset
        </a>
      </section>

      {/* CTA section — px pattern matches credibility section (256/128/24) */}
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
          <a
            href="https://considersentience.ai"
            className="bg-cloud border border-slate rounded-full px-[14px] py-[10px] md:px-4 md:py-3 text-[14px] md:text-[16px] uppercase tracking-[0.28px] md:tracking-[0.32px] text-ink hover:bg-[#4a4e55] hover:text-cloud transition-colors"
            style={wdth}
          >
            learn more
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(27,36,48,0.15)] flex items-center justify-center p-6 w-full">
        <p className="text-cloud text-[14px] text-center" style={wdth}>
          Copyright © 2026 Consider Sentience - All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
