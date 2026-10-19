# Freeze Point AC Care — demonstration site

A single-page marketing site for a fictional Karachi air-conditioning company, built to demonstrate design, motion and a working AI intake flow — not a live business. The brand, phone numbers, address, figures and photography are illustrative; the footer and the privacy dialog say so on purpose. Change the one content file below and it becomes a real company's site.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · hand-written CSS. No UI framework, no database, no analytics, no new dependencies for the assistant.

## Run

```bash
npm ci
npm run dev          # http://localhost:3000
```

Nothing to configure. The assistant answers from the offline knowledge base until a key is set.

## Changing niche, brand or copy

Everything a client would edit lives in **`src/lib/site-data.ts`**: name, tagline, phone/WhatsApp, hours, office, `refPrefix` (the reference the office quotes back), services, stats, proof points, brands marquee, process steps, FAQs, gallery, and the estimate form's service list.

That one file also feeds the assistant: the system brief and the offline answers are generated from it at request time, so the chatbot can never disagree with the page. Swapping `site-data.ts` swaps the business — including what the bot talks about.

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

- `POST /api/chat` streams SSE and never dead-ends: each model is tried in order, and if all of them fail or none is configured, the offline knowledge base answers — **including a completed booking**
- `GET /api/chat` reports what is wired up, without exposing keys
- the guided booking is a deterministic ten-step flow (`src/lib/ai/booking-flow.ts`): no model parses a phone number or a date, each answer is checked with the same `validateBooking()` the form uses, and the whole request is read back for confirmation before it is sent
- `src/lib/ai/sanitize.ts` is the safety net: an invented price or a narration of the model's reasoning never reaches a visitor, and markdown is flattened because the bubble is plain text
- requests carry `chat_template_kwargs: { thinking: false }`, verified against the gateway to suppress the `reasoning` field entirely
- provider config: `DAHL_API_KEY`, optional `DAHL_BASE_URL`, `DAHL_MODEL` (comma list, tried in order), `AI_PROVIDER_CHAIN`. See `.env.example`

## Estimate requests

`POST /api/bookings` and the chat flow share `src/lib/booking-store.ts`: origin check, JSON-only, size cap, honeypot, per-field validation, `requestId` idempotency, five-per-hour per email, and an optional forward to `LEAD_WEBHOOK_URL`. Storage is process memory only, so a deployment restart clears it — connect a webhook, inbox or database before a real business relies on it.

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
```

`smoke-test.mjs` (20 checks) walks the journey in Chromium: every image must decode with no 404, the marquee and contour motion must run, an estimate must complete through the chat UI and return an `FP-########` reference, the desktop panel must hold still through a long reply and a chip row, ten widths from 1600px to 320px must show no overflow and no clipped text, phones must get no decorative loops, `prefers-reduced-motion` must show everything with animation off, and the run must end with zero console errors and zero failed requests.

`deploy-check.mjs` is the one that looks at a *deployed* URL: the CSS the server actually serves must be current, no image may escape its container, the canonical host must answer 200, and the footer note must still be small print. Local testing cannot catch a stale build cache; that is what this is for.

## Before a client ships this as their own

1. Real name, phone, WhatsApp, hours, address, licence number and NTN — the footer has the slot waiting
2. Their own photography; the current images are generated placeholders
3. Real reviews with written permission, or leave the reviews section out (the invented ones were deleted rather than republished)
4. A lead destination: `LEAD_WEBHOOK_URL`, an inbox or a database — see above
5. Their own domain in `NEXT_PUBLIC_SITE_URL` (canonical, Open Graph, robots and sitemap follow it automatically)
6. A lawyer's eyes on the privacy and terms text — it is honest, not legal advice
