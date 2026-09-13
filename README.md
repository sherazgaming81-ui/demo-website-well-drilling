# Aquifer Well Co.

A complete, responsive demonstration website for a US water-well drilling business, built with Next.js App Router, React, and TypeScript. No database or third-party service is required to run it.

## Features

- Custom blue-and-cream visual identity, locally hosted fonts, and optimized photography.
- Responsive navigation, three service-detail dialogs, interactive customer-story carousel, and accessible FAQ accordion.
- Accessible native-dialog booking flow with project and contact steps, inline validation, loading/error states, and a downloadable request summary.
- Server-side validation, consent enforcement, origin checks, a honeypot, email-based throttling, and idempotency protection on the booking endpoint.
- No public endpoint exposes stored contact information.
- Reduced-motion support, keyboard navigation, focus restoration, and mobile touch controls.

## Run locally

1. Install the dependencies with `npm install`.
2. Run `npm run dev`.

There is nothing to provision — no `DATABASE_URL`, no migrations, no ORM config. The health check is `/api/health`.

## Validation

Run from the project root:

- `npx next typegen`
- `npm exec tsc -- --noEmit --pretty false`
- `npm run build`

For end-to-end browser checks against an already-running app:

- `npx playwright install --with-deps chromium`
- `node scripts/smoke-test.mjs`

Set `TEST_URL` to use another server. The smoke test checks the booking journey, API validation and idempotency, service dialogs, FAQs, customer stories, downloads, mobile navigation, seven screen widths, and health. It writes screenshots to `artifacts/` and saves a clearly fictional test request to the in-memory store.

## Important demo behavior

Aquifer Well Co. is a fictional brand. Experience figures, testimonials, and contact details are illustrative. Photography includes generated job-site/residential images and stock photography from Pexels and Unsplash.

Submitted requests are held in the server process memory only so the demo is fully functional without a database. They are not persisted, they are not emailed anywhere, and they do **not** schedule a real appointment, collect payment, or create a service contract. The form, confirmation, footer, and legal dialogs disclose this. Use fictional contact details when trying the demo.

For a real launch, store submissions in a database or CRM, replace sample business information and customer stories, verify service areas and credentials, connect an email provider server-side using environment variables, establish a retention policy, and configure stronger shared rate limiting as appropriate for traffic — an in-memory store does not survive cold starts and is not shared between serverless instances.

## Main files

- `src/app/page.tsx` — landing page and section interactions.
- `src/app/globals.css` — visual system and responsive styling.
- `src/components/booking-dialog.tsx` — booking form and confirmation.
- `src/components/modal.tsx` — accessible dialog shell.
- `src/app/api/bookings/route.ts` — validated booking endpoint with in-memory demo storage.
- `src/lib/booking.ts` — shared validation and date utilities.
- `src/lib/site-data.ts` — service, FAQ, and illustrative customer-story content.
