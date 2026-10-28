import { useState, useRef, useEffect, type ReactNode } from 'react';
import { MODELS } from './models';

export const wdth = { fontVariationSettings: '"wdth" 100' } as const;

export const EDGE_FUNCTION_URL = (import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL as string) ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
// v2: the tracker function lives next to run-demo, so no new env var is needed
export const TRACKER_URL = EDGE_FUNCTION_URL.replace(/run-demo\/?$/, 'tracker');

export const ORGS = [
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

// The backend keys orgs by exact name. The dropdown shows "Mercy for Animals";
// the backend expects "Mercy For Animals". Always send the API name.
export function apiOrgName(display: string): string {
  return display === 'Mercy for Animals' ? 'Mercy For Animals' : display;
}

// Status colors from the CS Solutions Design System (status/pass, status/fail)
export const STATUS = {
  pass: '#7a9e7e',
  fail: '#a85c4a',
  neutral: 'rgba(74,78,85,0.55)',
} as const;

export function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

// ---------- Dropdown (default / focus / hover states from Figma) ----------

export function Dropdown({
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
              className="bg-white hover:bg-cloud flex flex-col min-h-[52px] items-start justify-center px-3 py-2 w-full text-left"
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

// ---------- Pill toggle (same style as "sample questions / write your own") ----------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="border border-ink/55 rounded-full flex items-center p-[6px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-2 text-[12px] uppercase transition-colors ${
            value === o.value ? 'bg-ink text-white font-medium' : 'text-ink font-normal'
          }`}
          style={wdth}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Buttons ----------

export const primaryBtn = (disabled: boolean) =>
  `rounded-full px-[14px] py-[10px] md:px-4 md:py-3 text-[14px] md:text-[16px] tracking-[0.28px] md:tracking-[0.32px] uppercase transition-colors ${
    disabled ? 'bg-slate/40 text-white cursor-default' : 'bg-rust text-cloud cursor-pointer hover:bg-[#1b2430]'
  }`;

export const secondaryBtn =
  'whitespace-nowrap bg-cloud border border-slate rounded-full px-[14px] py-[10px] md:px-4 md:py-3 text-[14px] md:text-[16px] uppercase tracking-[0.28px] md:tracking-[0.32px] text-ink hover:bg-[#4a4e55] hover:text-cloud transition-colors cursor-pointer';

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-medium text-rust text-[14px] tracking-[0.28px] uppercase" style={wdth}>
      {children}
    </p>
  );
}

// ---------- Header / wordmark / footer (exact ports from Figma) ----------

export function SiteHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 bg-ink flex flex-col gap-[8px] items-start justify-center p-[16px] z-10">
      <a href="https://considersentience.ai" className="block h-[32px] w-[199px]">
        <img src="/logo.svg" alt="Consider Sentience" className="h-[32px] w-[199px] object-cover" />
      </a>
      <a href="https://considersentience.ai" className="group relative block h-[21px]">
        <div className="group-hover:hidden [word-break:break-word] content-stretch flex gap-[5px] items-center justify-center leading-[0] relative text-[#edeef1] text-center w-[127px] whitespace-nowrap">
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
  );
}

export function Wordmark() {
  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="flex flex-col gap-1 items-center">
        <a href="/" className="flex gap-[2px] items-center justify-center">
          {['a', 'v', 'a', 'i', 'l'].map((ch, i) => (
            <span key={i} className="flex items-center">
              <span className="font-semibold text-cloud text-[24px] tracking-[0.48px] uppercase" style={wdth}>
                {ch}
              </span>
              {i < 4 && <span className="size-1 rounded-full bg-cloud inline-block mx-[2px]" />}
            </span>
          ))}
        </a>
        <p className="font-medium text-cloud text-[16px] tracking-[0.32px] uppercase" style={wdth}>
          animal visibility ai landscape
        </p>
      </div>
      <div className="flex gap-[6px] items-center">
        <span className="font-['Nunito'] text-rust text-[20px] tracking-[-0.4px]">[</span>
        <span className="font-['Source_Serif_4'] italic font-medium text-white/70 text-[14px] tracking-[-0.28px]">
          a project from
        </span>
        <a href="https://considersentience.ai" className="block h-[20px] w-[124px]">
          <img src="/logo.svg" alt="Consider Sentience" className="h-[20px] w-[124px] object-cover" />
        </a>
        <span className="font-['Nunito'] text-rust text-[20px] tracking-[-0.4px]">]</span>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[rgba(27,36,48,0.15)] flex items-center justify-center p-6 w-full">
      <p className="text-cloud text-[14px] text-center" style={wdth}>
        Copyright © 2026 Consider Sentience - All Rights Reserved.
      </p>
    </footer>
  );
}

// ---------- Design-system pieces (CS Solutions Design System) ----------

// Card — Finding/Callout (8:257)
export function FindingCard({ stat, label, quote }: { stat: string; label: string; quote: string }) {
  return (
    <div className="bg-white border border-[rgba(74,78,85,0.12)] border-solid flex flex-col gap-[16px] items-start p-[24px] rounded-[8px] w-full">
      <div className="flex flex-col gap-[8px] items-start w-full">
        <p className="font-semibold leading-[44px] text-rust text-[36px] w-full" style={wdth}>{stat}</p>
        <p className="font-medium leading-[24px] text-slate text-[15px] w-full" style={wdth}>{label}</p>
      </div>
      <div className="bg-[rgba(74,78,85,0.15)] h-px w-full" />
      <div className="flex gap-[12px] items-start w-full">
        <div className="bg-[rgba(201,124,46,0.5)] h-[40px] rounded-[2px] shrink-0 w-[3px]" />
        <p className="flex-1 font-normal leading-[20px] min-w-px text-slate text-[13px]" style={wdth}>{quote}</p>
      </div>
    </div>
  );
}

// Accordion row (8:271 collapsed / 8:275 expanded)
export function AccordionRow({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    // Design-system accordion is tinted-on-light; on AVAIL's dark page it sits on a cloud card (same as the input panel)
    <div className="bg-cloud flex flex-col items-start rounded-[8px] w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between gap-4 px-[16px] py-[12px] w-full text-left"
      >
        <span className="font-medium leading-[24px] text-ink text-[15px]" style={wdth}>{title}</span>
        <span className={`shrink-0 text-rust ${open ? 'text-[16px]' : 'text-[24px]'}`} style={wdth}>
          {open ? '—' : '+'}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 items-start p-[16px] pt-0 w-full">
          <div className="font-normal leading-[20px] text-slate text-[13px] w-full flex flex-col gap-3" style={wdth}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// Leaderboard-style table of exactly which models are queried.
export function ModelsTable() {
  return (
    <div className="bg-white border border-[rgba(74,78,85,0.12)] border-solid flex flex-col overflow-hidden rounded-[8px] w-full">
      <div className="hidden md:flex items-center px-[16px] py-[10px] border border-[rgba(74,78,85,0.15)]">
        {['Assistant', 'Exact model ID', 'Served by', 'How it finds sources'].map((h, i) => (
          <p
            key={h}
            className={`font-semibold leading-[16px] text-slate text-[11px] uppercase ${
              ['w-[190px]', 'w-[260px]', 'w-[130px]', 'flex-1'][i]
            } shrink-0 ${i === 3 ? 'shrink' : ''}`}
            style={wdth}
          >
            {h}
          </p>
        ))}
      </div>
      {MODELS.map((m, i) => (
        <div
          key={m.key}
          className={`flex flex-col md:flex-row md:items-center gap-1 md:gap-0 px-[16px] py-[10px] border border-[rgba(74,78,85,0.08)] ${
            i % 2 ? 'bg-[rgba(237,238,241,0.5)]' : 'bg-white'
          }`}
        >
          <p className="font-medium leading-[20px] text-ink text-[14px] md:w-[190px] shrink-0 md:pr-4" style={wdth}>
            {m.name}
          </p>
          <p className="font-normal leading-[20px] text-ink text-[13px] md:w-[260px] shrink-0 md:pr-4 break-all" style={wdth}>
            {m.modelId}
          </p>
          <p className="font-normal leading-[20px] text-slate text-[13px] md:w-[130px] shrink-0 md:pr-4" style={wdth}>
            {m.provider}
          </p>
          <p className="font-normal leading-[20px] text-slate text-[13px] flex-1" style={wdth}>{m.how}</p>
        </div>
      ))}
    </div>
  );
}
