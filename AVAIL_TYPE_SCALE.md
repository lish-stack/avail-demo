# AVAIL type scale

Font: IBM Plex Sans (`wdth` 100). Caps = uppercase. Sizes are desktop / mobile.
Rule of thumb: **regular is the default; medium is only for emphasis words and small labels.** Headings are never bold.

| Role | Size | Weight | Case / tracking | Color | Used for | Why |
|---|---|---|---|---|---|---|
| Hero H1 | 40 / 24 | Regular (accent words Medium) | none | cloud, accent rust | Page headline | Largest thing on the page, so it needs no weight to lead |
| Wordmark | 24 | Semibold | Caps | cloud | AVAIL logo only | The only semibold on the page, so the brand is unmistakable |
| Section title | 28 / 20 | Regular (accent word Medium) | Caps, .56 / .4 | cloud, accent rust | "Exactly which MODELS we ask", "Why this MATTERS", "Not sure where to START?" | One accent word per title carries the emphasis |
| CTA title | 20 | Medium | Caps, .4 | white on rust | Orange call-to-action card | Sits on a color field, so a little more weight keeps it readable |
| Sub-head (dark page) | 20 | Regular | Caps, .4 | cloud | Tracker page: "By question", "Run history" | One step below section title |
| Stat number | 28 | Medium | none, .56 | rust | Percentages in finding cards and tracker cards | The number is the point; medium + rust makes it scan first |
| Panel intro | 16 | Medium | none | slate | Sentence under the mode toggle | |
| Form fields (dropdowns, inputs, text areas) | 15 | Regular | none | ink | Everything the user types or picks | One size across every form state |
| Body | 15 | Regular, lh 1.6 | none | cloud (dark) / ink (cards) | Paragraphs, table cell primary text | Comfortable reading size |
| Field label / table column header | 14 | Medium | Caps, .28 | rust | "Organization", "Questions", column headers, card labels | Same style everywhere a label appears, so tables and forms read as one system |
| Secondary text | 14 | Regular | none | ink / slate | Table cells, status text | |
| Small button | 11 | Regular | Caps, .22 | ink on cloud, rust icon | "Upload CSV" | Same scale as the secondary toggle, so it ranks below Run check / Start tracking |
| Primary toggle (mode) | 12 | Active Medium, inactive Regular | Caps | white on ink / ink | Check one question / Track a list | Top level choice |
| Secondary toggle | 11 | Active Medium, inactive Regular | Caps | white on slate gray / ink | Sample / write your own, Once / Weekly / Monthly | Smaller and tighter, so it clearly sits under the primary toggle |
| Buttons | 16 / 14 | Regular | Caps, .32 / .28 | white on rust / ink on cloud | Run check, Start tracking, See the open dataset | Rounded pills |
| Notes, captions, model IDs | 12 | Regular | none | slate 55% (emphasis Medium) | Notes, counters, helper text, model IDs | Smallest tier |
| Footer | 14 | Regular | none | cloud | Copyright line | |

## Surfaces
- Cards, tables and panels: cloud fill, 1px rust border, 8px radius.
- Table: rust column headers (14 medium caps) on a rust bottom rule, rows split by rust at 40% opacity, no zebra striping.
- Status dots: pass #7A9E7E, fail #A85C4A.

## Where this differs from BEARCLAW
All-caps headings and CTAs, pill buttons, rust-bordered cloud surfaces with rust column headers, and regular-weight headings. BEARCLAW uses semibold 11px caps headers and white cards.
