# Aquifer Reach LLC — water well drilling website

Single-page marketing site for a licensed Florida well drilling contractor, built with Next.js (App Router), React and TypeScript. One design system, one stylesheet, no UI framework, no database.

**Live:** https://aquiferreachllc.vercel.app (Vercel auto-deploys on push to `main`); `NEXT_PUBLIC_SITE_URL` overrides the canonical/OG/sitemap host)
**Business details used:** Aquifer Reach LLC, (904) 477-9809 · 14404 Bartram Creek Blvd, St Johns, FL 32259 (mailing) · 646 E 21st St, Jacksonville, FL 32206 (yard, by appointment) · Mon–Fri 8 am–6 pm, Sat 8 am–12 pm · family-owned since 2017 · six services: rock, screen, artesian, salt & pepper, pump installation, well abandonment.

## Run it

```bash
npm ci
npm run dev      # http://localhost:3000
```

No environment variables are required to run or build.

## Editing content

Everything a non-developer would touch lives in one file: **`src/lib/site-data.ts`**

- `business` — name, phone, both addresses, hours, founding year
- `services` — the six service cards, their dialog copy and photos
- `stats` / `proofPoints` / `promises` — the trust bar and the "Why choose us" list
- `steps` — the three-step process
- `faqs` — accordion copy
- `projects` — the work gallery, with captions (tiles render three across at 3:2)
- `bookingServices` — the options in the estimate form (ids must stay in sync with `services[].id`)

Typography, colour and layout live in `src/app/globals.css`. Photography lives in `public/images/` — keep the crop ratios used there (hero 928×1152, service cards 1200×800, gallery 900×900 / 1200×900) or pass new sizes to the same `next/image` components.

The tab icon is `src/app/icon.svg` — a vector redraw of the company logo with no background plate. `src/lib/logo-mark.ts` is generated from it (do not hand-edit) and feeds the header and footer brand mark, so the favicon and the in-page mark can never differ. `src/app/apple-icon.png` is the same artwork for the home screen.

The self-hosted variable font is `public/fonts/dm-sans.ttf` (DM Sans, SIL Open Font License 1.1, `OFL.txt` included); one `@font-face` rule in `globals.css` covers every weight the design uses.

## Estimate requests

`POST /api/bookings` validates the form server-side: JSON only, size cap, origin check, hidden honeypot field, per-field validation, idempotency via a client-generated `requestId`, and a five-per-hour limit per email. `GET /api/health` reports how leads are currently handled.

Records are kept in the web server's memory only, so **a submission is not durable on serverless** — it exists to confirm the flow works. To receive real leads, set one environment variable in Vercel and the same request is forwarded, best-effort, without changing any code:

```
LEAD_WEBHOOK_URL = https://your-endpoint/leads
```

Any HTTP receiver works: a Zapier/Make catch hook, a CRM webhook, a Slack workflow, or an endpoint that emails the office. The payload is

```json
{ "reference": "AQ-1A2B3C4D", "receivedAt": "…", "fullName": "…", "email": "…",
  "phone": "…", "zip": "…", "service": "pump-installation", "serviceLabel": "Pump installation or repair",
  "preferredDate": "2026-09-30", "timePreference": "morning", "notes": "…", "source": "aquifer-reach-website" }
```

A failed forward is logged and never blocks the customer's confirmation. If leads must be queryable later, add storage (Vercel Blob, Postgres, Sheet) in `src/app/api/bookings/route.ts` — the module deliberately does not read any environment variable at import time, so a missing variable can never break the build.

## Motion

Motion is deliberately light and skippable — nothing depends on it to be readable.

- `src/lib/use-reveals.ts` drives scroll reveals with one `IntersectionObserver` for the page. Elements opt in with `rv(index)` from `src/lib/site-data`-consuming components, and the observer marks them with a `data-shown` **attribute**, not a class: React rewrites `className` on every re-render, and a class marker gets wiped when a dialog closes, which would leave sections faded out forever.
- `src/app/layout.tsx` sets `js-reveal` on `<html>` before first paint, so hidden-until-revealed styling only exists when scripts actually run.
- `src/components/count-up.tsx` counts the trust-bar figures up when they scroll into view.
- The contour lines in the navy "why us" and blue closing panels drift and breathe (`contour-drift`, `contour-breathe`); the hero photograph breathes (`hero-breathe`); buttons catch a sheen; cards and gallery tiles lift; FAQ answers ease open.
- The header compacts after 28px of scroll and grows a reading-progress line under it, driven by a single rAF-throttled `--scroll` custom property.
- Everything is neutralised under `prefers-reduced-motion: reduce` — content is visible immediately and the animations are switched off. The smoke test asserts exactly that.

If you want less motion, delete the `/* ── Motion ── */` block at the end of `src/app/globals.css`; the markup keeps working because `[data-reveal]` alone does nothing without those rules.

## Checks

```bash
npm run build
npx tsc --noEmit
npm run lint
npx playwright install --with-deps chromium
npm start                      # in another shell
TEST_URL=http://127.0.0.1:3000 node scripts/smoke-test.mjs
TEST_URL=http://127.0.0.1:3000 node scripts/lead-endpoint-check.mjs
```

`smoke-test.mjs` (15 checks) walks the real journey in Chromium: every image must decode with no 404, the DM Sans face must be active, the six service cards and their dialogs work, an estimate request completes end to end and returns an `AQ-########` reference, the downloadable summary matches it, the API rejects bad input (422 / 403 / 400 / 415) and repeats idempotently, no element overflows or clips at ten widths from 1600px to 320px, mobile navigation hands off correctly, and the run finishes with zero console errors and zero failed requests, and the motion layer is verified: every `[data-reveal]` element ends up shown, the contour rings report a running animation, the counted stats settle on `8+` and `1,000s`, and `prefers-reduced-motion` is re-tested with emulation. `lead-endpoint-check.mjs` (11 checks) hits the endpoint directly.

If the CSS looks unchanged after an edit, delete `.next` before rebuilding — Turbopack can hand back a cached stylesheet.

## Before this goes live for the client

1. **Point the domain.** Metadata and `robots.txt`/`sitemap.xml` assume `https://aquiferreach.com`; override with `NEXT_PUBLIC_SITE_URL` while testing on another host.
2. **An email address.** The company's current site publishes none — it takes enquiries by phone only. If the client wants an address on the site, they need to supply one; nothing here invents one.
3. **Social profiles.** Same situation: none are linked anywhere on their current site, so no social icons exist here either.
4. **Reviews.** The invented testimonials and the "4.9/5" star rating from the template were removed rather than republished. If the client has real Google reviews, they can go back into `site-data.ts` with the customer's written permission.
5. **Confirm the photo licence.** Every image here was taken from the business's existing website. If a different vendor shot or owns them, confirm the client may reuse them on a new site.
6. **Have the client read the privacy and terms copy** in `src/app/page.tsx`. It describes what the form collects and states that an estimate is not a contract, but it is not legal advice.
7. **Set `LEAD_WEBHOOK_URL`** (above), otherwise submitted requests vanish when the serverless function cools down.

## Layout

```
src/app/page.tsx            sections: hero, trust bar, services, why us, process,
                            work gallery, FAQs, closing CTA, footer, dialogs
src/app/layout.tsx          metadata, Open Graph, canonical, robots directive
src/app/robots.ts           robots.txt
src/app/sitemap.ts          sitemap.xml
src/app/globals.css         design system, every breakpoint, no framework
src/app/api/bookings/       validated estimate endpoint
src/app/api/health/         status endpoint
src/components/             booking dialog, modal shell, inline SVG icon set
src/lib/booking.ts          shared validation, date bounds, formatting
src/lib/site-data.ts        all business content
public/                     photography, variable font, license
scripts/                    browser and endpoint checks
```
