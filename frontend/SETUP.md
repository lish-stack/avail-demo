# AVAIL Frontend — Setup & Deploy

This is the real, first implementation of your Figma design, wired to the
already-working Supabase Edge Function backend (`avail-demo/supabase/functions/run-demo`).

## What's built

- Full page layout matching your Figma design: header, hero, input panel,
  results, credibility section, CTA, footer
- Both input-panel states (sample questions ↔ write your own), matching your
  two designed variants
- A custom dropdown component matching your `drowdown-list` design
- A loading state and error/rate-limit state (not explicitly in the Figma
  file, designed to match your existing button/panel styling)
- Results cards for all 4 assistants, using the status colors already
  established (green/cited, white/not-cited, muted grey/unavailable)
- Responsive at your three breakpoints (approximate — Tailwind's fixed
  breakpoints don't perfectly match 800px, used 768px as the closest
  standard breakpoint)

**Known gaps, worth a look before the summit:**
- The `imgFull` "considersentience" wordmark logo from Figma was a temporary
  asset URL (7-day expiry) — I did NOT use it, and instead rebuilt the
  logo lockup as styled text (orange "consider" + white/italic "sentience").
  If you have the actual logo file, swap it in for a pixel-perfect match.
- Chevron-down dropdown icon is a hand-drawn inline SVG, not the exact
  Figma asset — visually close but worth a glance.
- This is genuinely untested code — expect a debugging pass on first run,
  consistent with everything else built this session.

## Step-by-step

**1. Move this whole `avail-demo-frontend` folder to your Desktop** (or
wherever you keep your projects), then in a terminal:

```bash
cd ~/Desktop/avail-demo-frontend
npm install
```

**2. Create your `.env` file** (copy the example and fill in real values):

```bash
cp .env.example .env
```

Then edit `.env` with:
- `VITE_SUPABASE_EDGE_FUNCTION_URL` — your deployed function URL (you already
  have this: `https://npmruwaqvoklcxbjjfez.supabase.co/functions/v1/run-demo`)
- `VITE_SUPABASE_ANON_KEY` — from Supabase → Project Settings → API →
  "anon public" key (the same one you used in your curl test)

**3. Run it locally:**

```bash
npm run dev
```

Open the local URL it gives you (usually `http://localhost:5173`). Test the
full flow: pick an org, pick a sample question, hit Run Check, confirm real
results come back. Try "Write your own" too. Try a few different orgs to see
different cited/not-cited outcomes.

**4. Once it works locally, push to GitHub and deploy to Vercel** (same
pattern as before):

```bash
git init
git add .
git commit -m "Initial AVAIL frontend build"
```

Create a new repo on GitHub, then:
```bash
git remote add origin https://github.com/your-username/avail-demo-frontend.git
git push -u origin main
```

**5. In Vercel:** New Project → import this repo → in Environment Variables,
add both `VITE_SUPABASE_EDGE_FUNCTION_URL` and `VITE_SUPABASE_ANON_KEY` with
the same values as your `.env` → Deploy.

**6. Confirm the deployed `.vercel.app` URL works the same as local**, then
move to the custom domain step (`demoavail.considersentience.ai`) from the
earlier `avail-demo/DEPLOY.md` guide — same process: add the domain in
Vercel, get the CNAME target, add it in GoDaddy.

## If something breaks

- **Blank page / console errors about `import.meta.env`:** double check
  `.env` exists and both variables are spelled exactly as shown above —
  Vite only exposes env vars prefixed with `VITE_`.
- **CORS or 401 errors on Run Check:** confirm the anon key is correct and
  current (keys can be rotated in Supabase settings).
- **Dropdown doesn't close when clicking outside:** let me know — there's a
  click-outside handler built in, but worth confirming it works as expected
  in your browser.
- **Fonts look wrong:** confirm you have internet access when loading the
  page — fonts load from Google Fonts via `index.html`, not bundled locally.
