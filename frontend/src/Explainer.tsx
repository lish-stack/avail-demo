import { AccordionRow, FindingCard, ModelsTable, bodyCls, sectionCls, sectionTitleCls, wdth } from './shared';

// Section order matches the credibility section's layout exactly (same padding, same full-width text),
// so line lengths and left edges line up across the page.
// Numbers come from the verified pilot (60 questions x 4 assistants x 2 runs = 480 responses).

export function SectionTitle({ lead, accent, tail }: { lead: string; accent: string; tail?: string }) {
  return (
    <p className={sectionTitleCls} style={wdth}>
      {lead} <span className="font-medium text-rust">{accent}</span>
      {tail ? ` ${tail}` : ''}
    </p>
  );
}

export function ModelsSection() {
  return (
    <section className={sectionCls}>
      <SectionTitle lead="Exactly which" accent="models" tail="we ask" />
      <p className={bodyCls} style={wdth}>
        Every check calls these model versions directly through their developer APIs, with web search turned on. We
        name them so results can be reproduced and compared. API results can differ from what you see in each company’s
        own app, and models are updated over time, so treat each result as a snapshot.
      </p>
      <ModelsTable />
    </section>
  );
}

export function WhySection() {
  return (
    <section className={sectionCls}>
      <SectionTitle lead="Why this" accent="matters" />
      <p className={bodyCls} style={wdth}>
        More people now ask an AI assistant before they open a search engine. When an assistant answers a question
        about animals, the sources it cites decide whose expertise the reader sees, and whose gets skipped. Most
        organizations have never checked where they stand. We tested 480 AI answers to real questions about animals. Here is what we found:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <FindingCard
          stat="At least 6 in 10"
          label="answers linked to an organization’s own website when the question named that organization"
        />
        <FindingCard
          stat="Fewer than 1 in 10"
          label="answers linked to it when the question was a general one about its topic and did not name any organization"
        />
      </div>

      <div className="flex flex-col gap-3 w-full">
        <AccordionRow title="What is answer engine optimization (AEO)?">
          <p>
            Search engine optimization (SEO) helps people find your website in a search engine. AEO is the same idea
            for AI assistants: understanding when they cite you, when they cite someone else, and what you can change.
            It is sometimes called generative engine optimization (GEO).
          </p>
        </AccordionRow>
        <AccordionRow title="Why should my organization care?">
          <p>
            A citation sends the reader to your work, credits your expertise, and builds trust in what you say. If an
            assistant answers a question in your area and cites a different source, your research and campaigns are
            invisible at the moment someone is deciding what to believe.
          </p>
          <p>
            Most organizations are not yet asking whether they are the top citation for the topics they work on. You
            can’t improve what you haven’t measured, and a baseline takes a few minutes.
          </p>
        </AccordionRow>
        <AccordionRow title="What can an organization do about it?">
          <p>
            Practitioners in this field suggest publishing original facts and statistics that AI answers can quote
            directly, and making your most useful pages easy to find. We have not tested cause and effect yet. AVAIL
            currently measures where you stand; suggested changes to your content are our next step.
          </p>
        </AccordionRow>
        <AccordionRow title="What does AVAIL measure, and what doesn’t it?">
          <p>
            AVAIL counts <span className="font-medium">direct citations</span>: an answer that links to your
            organization’s own website. It does not yet detect when you are named without a link, or when your work
            shapes an answer without credit.
          </p>
          <p>
            AI answers vary from run to run, so a single check is a snapshot. Tracking a question list over time shows
            what’s stable and what’s noise.
          </p>
        </AccordionRow>
      </div>
    </section>
  );
}
