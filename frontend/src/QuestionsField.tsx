import { useRef } from 'react';
import { FieldLabel, smallBtn, wdth } from './shared';

export const MAX_QUESTIONS = 25;

// Minimal CSV reader: first column only, handles quoted fields, skips a header row.
export function parseCsvFirstColumn(text: string): string[] {
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

export default function QuestionsField({
  text,
  setText,
  onDark = false,
}: {
  text: string;
  setText: (t: string) => void;
  onDark?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const count = text.split('\n').map((l) => l.trim()).filter(Boolean).length;
  const note = onDark ? 'text-cloud/70' : 'text-slate/55';

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setText(parseCsvFirstColumn(String(reader.result ?? '')).join('\n'));
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

  return (
    <div className="flex flex-col gap-3 items-start w-full">
      <FieldLabel>Questions</FieldLabel>
      <div className={`bg-white border border-solid rounded w-full p-4 ${text ? 'border-[#c97c2e]' : 'border-slate/55'}`}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'One question per line, or upload a CSV.\nExample: Is Vegan Outreach a good charity to donate to?'}
          className="w-full h-[160px] resize-none border-none outline-none text-[15px] text-ink placeholder:text-slate/55 bg-transparent"
          style={wdth}
        />
      </div>
      <div className="flex items-center justify-between gap-3 w-full">
        <button type="button" onClick={() => fileRef.current?.click()} className={smallBtn} style={wdth}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-rust group-hover:text-cloud shrink-0" aria-hidden="true">
            <path d="M8 11V3M8 3L5 6M8 3l3 3M3 12v1h10v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          upload csv
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        <p className={`text-[12px] ${count > MAX_QUESTIONS ? 'text-[#e0846f] font-medium' : note}`} style={wdth}>
          {count} / {MAX_QUESTIONS}
        </p>
      </div>
      <p className={`text-[12px] ${note}`} style={wdth}>
        <button type="button" className="underline hover:text-rust" onClick={downloadTemplate}>
          Download this template
        </button>
        , fill it out, and upload it above for best results.
      </p>
    </div>
  );
}
