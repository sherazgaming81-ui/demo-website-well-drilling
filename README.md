# Freeze Point AC Care — demonstration site

A marketing site for a fictional Karachi air-conditioning company — a home page plus a page per service area, built to demonstrate design, motion and a working AI intake flow — not a live business. The brand, phone numbers, address, figures and photography are illustrative; the footer and the privacy dialog say so on purpose. Change the one content file below and it becomes a real company's site.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · hand-written CSS. No UI framework, no database, no analytics, no new dependencies for the assistant.

## Run

```bash
npm ci
npm run dev          # http://localhost:3000
```

Set a Dahl key for the assistant, or leave it out — without one the chat says plainly that it cannot answer and points at the phone number and the form. It never invents an answer.

## Changing niche, brand or copy

Everything a client would edit lives in **`src/lib/site-data.ts`**: name, tagline, phone/WhatsApp, hours, office, `refPrefix` (the reference the office quotes back), services, stats, proof points, brands marquee, process steps, FAQs, gallery, the estimate form's service list, and `serviceAreas` — the list the locality pages are generated from.

That one file also feeds the assistant: the system brief it is given is generated from it at request time, so the chatbot can never disagree with the page. Swapping `site-data.ts` swaps the business — including what the bot talks about.

Design and motion live in `src/app/globals.css`:
- tokens at the top (`--paper`, `--ink`, `--blue`, `--navy`, `--frost`, `--amber`, `--line`)
- fonts are self-hosted variable woff2, subset to the ranges used (`public/fonts/`, SIL OFL; `freeze-urdu.woff2` carries the one Urdu line)
- the header carries the logo (`public/logo.webp`, 58px tall on desktop, shrinking at 1180px and 850px, and
  swapped for the square mark under 760px). The mark (`public/mark.webp`) is what the favicon set reuses, and it
  is cut from the logo itself - a 248px square window taken out of the plaque, centred on the snowflake, ending
  6px before the first letter of the wordmark, so no pixel is redrawn and no glyph is sliced. Favicon tiles are
  full-bleed squares (16/32/48/64 `src/app/favicon.ico` + `icon.png`, 180 `apple-icon.png`, 192/512
  `public/icons/`): no rounded corners, because a transparent corner paints white in a light tab. The in-site
  mark keeps the tile's rounding instead, where paper shows through it
- **motion policy**: decorative loops (contour rings, hero breathe, frost sweep, marquee) run on pointer-fine devices only and are off under `prefers-reduced-motion`; meaningful motion (scroll reveals) stays everywhere

## Assistant

- `POST /api/chat` streams SSE and tries each model in the list in order. If the whole chain fails
  — or no key is set — it answers **503 with one honest sentence** and the number to call, because a
  scripted "knowledge base" reply is a guess wearing a brand's name. The visitor is never stranded:
  the phone number and the inspection form are one tap away in the panel
- the guided booking works whether or not a model answers, because it is not a model: `booking-flow.ts`
  is a deterministic state machine on the server, so an outage never loses a request mid-conversation
- `GET /api/chat` reports what is wired up, without exposing keys
- **one surface**: the floating box on the home page. There used to be a `/assistant` page for
  long answers; it is gone, and `Expand window` in the panel's ⋯ menu does that job in place —
  one widget, so behaviour and validation cannot exist in two versions
- the panel opens on a greeting (*Hi there 👋 / How can we help?*) with four starters, then the
  transcript: bubbles with a `Freeze Point · AI assistant · just now` line under each answer, a
  searchable emoji picker (groups, colour-emoji font, and a *Frequently used* row only once the
  visitor has earned it by using one), and deliberately **no** attachment or voice control — a
  paperclip that cannot receive a file is a dead end, which is the one thing this widget is not
  allowed to be
- the booking flow asks **in words and nothing else**: no chip row and no progress bar. The choice steps
  are asked as a numbered list ("3. Gas charging or leak repair"), and replying `3` is as good as typing
  the name; the stage it is on is said in the header line ("Step 2 of 10 · your area of the city")
- the conversation is kept in `sessionStorage` (`freezepoint.chat.v1`) with its `sessionId`, so a
  reload offers the last message back on a *Recent message* card instead of dumping a half-finished
  booking on the floor. Nothing is sent by it, it dies with the tab, and `Start a new chat` clears
  it; the privacy dialog says exactly this
- the guided booking is a deterministic ten-step flow (`src/lib/ai/booking-flow.ts`): no model parses a phone number or a date, each answer is checked with the same `validateBooking()` the form uses, and the whole request is read back for confirmation before it is sent
- `src/lib/ai/sanitize.ts` is the safety net: an invented price or a narration of the model's reasoning never reaches a visitor, and markdown is flattened because the bubble is plain text
- requests carry `chat_template_kwargs: { thinking: false }`, verified against the gateway to suppress the `reasoning` field entirely
- provider config: `DAHL_API_KEY`, optional `DAHL_BASE_URL`, `DAHL_MODEL` (comma list, tried in order), `AI_PROVIDER_CHAIN`. See `.env.example`

## Estimate requests

`POST /api/bookings` and the chat flow share `src/lib/booking-store.ts`: origin check, JSON-only, size cap, honeypot, per-field validation, `requestId` idempotency, five-per-hour per email, and an optional forward to `LEAD_WEBHOOK_URL`. Storage is process memory only, so a deployment restart clears it — connect a webhook, inbox or database before a real business relies on it.

## Areas

`serviceAreas` in `src/lib/site-data.ts` drives a page per locality: `/areas` lists them, `/areas/clifton`, `/areas/dha`,
`/areas/gulshan-e-iqbal`, `/areas/north-nazimabad`, `/areas/malir` and `/areas/saddar-shahrah` are built from the same entries at
build time (`generateStaticParams`), and an unknown slug 404s rather than rendering an empty page.

- Each page carries its own `Service` + `FAQPage` + `BreadcrumbList` graph, generated from the same data by `src/lib/schema.ts`,
  which also emits the site-wide `LocalBusiness` (in `layout.tsx`) and the home page's `FAQPage`. No `aggregateRating`, no
  `priceRange`: nothing is claimed in structured data that the page does not say out loud.
- Every entry needs `name`, `slug`, `label`, `blocks`, `eta`, `intro`, `watchFor`, `access`, `services` (ids from `services`),
  `faqs` and `nearby` (slugs) — `area.name` must survive `validateBooking()`'s area rule, so it is words, not punctuation.
- The CTA on an area page is `/?book=1&area=<name>&service=<id>`. The home page reads that once on mount, opens the one booking
  dialog with the area and service prefilled, and cleans the URL. There is no second form anywhere.
- The assistant is told the same list, in the same words, so it cannot offer an area the site does not claim.
- `sitemap.xml` grows with the data; the home page links all of them from the strip at the end of the services section.

## Motion

| | |
|---|---|
| Everywhere | scroll reveals with a sibling stagger; headings, cards, proof list, gallery and footer each arrive once |
| Fine pointer + wide window | parallax on the hero, every service image and every gallery tile (one rAF loop writing `--py`, no React state while scrolling); a cold haze trailing the cursor; the frost sweep across the hero photo; the marquee leaning into 3D on hover; card lift and a light sweep; the thermo card glowing and pulsing |
| Scroll-driven | a process rail whose three segments fill as each step reaches the middle of the viewport, with the active step lifting |
| Interaction | the work gallery opens a lightbox that FLIP-zooms out of the clicked tile (arrows page, Escape closes, scroll locked, focus returns); a draggable before/after comparison with keyboard support and ARIA slider semantics; buttons press in and their arrows slide; the success tick draws itself; chat bubbles arrive in sequence |
| Never | on touch devices or under `prefers-reduced-motion`: parallax, the haze, the sweeps and the nudges switch off, while the reveals (which carry meaning) stay |

`smoke-test.mjs` asserts this behaviourally rather than trusting it: that `--py` is actually written, the rail fills, the lightbox locks scroll and closes on Escape, the comparison handle moves from both keys and a drag while `aria-valuenow` stays in step, that no haze is mounted and no transform is written at 390px, and that the run ends with zero console errors.

## Checks

```bash
npm run build
npx tsc --noEmit
npm run lint
npx playwright install chromium
npm start &                                          # in another shell
TEST_URL=http://127.0.0.1:3000 node scripts/smoke-test.mjs
TEST_URL=http://127.0.0.1:3000 node scripts/chat-booking-check.mjs
TEST_URL=http://127.0.0.1:3000 node scripts/lead-endpoint-check.mjs
npm run check:deploy                                   # against a deployed URL
node scripts/make-og.mjs                                 # rebuilds public/og.jpg from site-data + real fonts
```

`smoke-test.mjs` (39 checks) walks the journey in Chromium: every image must decode with no 404, the marquee and contour motion must run, an estimate must complete through the chat UI and return an `FP-########` reference, the desktop panel must hold still through a long reply and a stage change and must not clip its own composer at 720/660/600/540px of height, the greeting must not invent a history and the option menu must resize / download / clear for real, ten widths from 1600px to 320px must show no overflow and no clipped text, phones must get no decorative loops, `prefers-reduced-motion` must show everything with animation off, and the run must end with zero console errors and zero failed requests.

`scripts/make-og.mjs` renders the 1200x630 share card in Chromium from the same `site-data.ts` (it asserts the two web fonts and
both images actually loaded, because a silently-fallback OG card is exactly the kind of thing that ships broken), then downsamples
it to 1x with `scale: "css"` so the type stays crisp without an image library in the dependencies.

`deploy-check.mjs` is the one that looks at a *deployed* URL: the CSS the server actually serves must be current, no image may escape its container, the canonical host must answer 200, and the footer note must still be small print. Local testing cannot catch a stale build cache; that is what this is for.

## Before a client ships this as their own

1. Real name, phone, WhatsApp, hours, address, licence number and NTN — the footer has the slot waiting
2. Their own photography; the current images are generated placeholders
3. Real reviews with written permission, or leave the reviews section out (the invented ones were deleted rather than republished)
4. A lead destination: `LEAD_WEBHOOK_URL`, an inbox or a database — see above
5. Their own domain — see **Going live on a real domain** below (canonical, Open Graph, robots and sitemap follow it automatically)
6. A lawyer's eyes on the privacy and terms text — it is honest, not legal advice

## Going live on a real domain

Nothing in the code hardcodes a host, so this is a five-minute job and there is nothing to remember afterwards:

1. **Vercel → Settings → Domains → Add** the client's domain. Point it at Vercel either by moving the nameservers at the registrar
   (easiest with a Pakistani registrar: keep the zone there and add the `A 76.76.21.21` + `CNAME cname.vercel-dns.com` records Vercel
   lists instead), then wait for the green check.
2. **Set `NEXT_PUBLIC_SITE_URL=https://www.theirdomain.com`** in Vercel → Environment Variables for *Production* and *Preview*.
   Canonical tags, `og:url`, the JSON-LD `@id`s, `robots.txt`'s sitemap line and every `sitemap.xml` entry read `src/lib/site-url.ts`,
   which prefers that variable, then Vercel's own project domain, then the demo host. One variable, and all of it moves together.
3. **Redirect the bare domain** to `www` (Vercel does this with a domain redirect, not a code change) so there is one canonical host
   and no duplicate-content second site.
4. **Redeploy** so the prerendered pages pick the new value up, then `npm run check:deploy` with `DEPLOY_URL` set to the new host —
   it is the check that asserts the canonical host answers, assets resolve and the served CSS is current.
5. **Google**: Search Console property for the new domain + submit `sitemap.xml`; Business Profile with the same phone number and
   address the site shows (a mismatch between the two is what gets profiles suspended, not the website itself).
