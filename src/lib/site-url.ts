/**
 * One canonical host for the whole site: metadata + OG tags (src/app/layout.tsx),
 * robots.txt and sitemap.xml all read this, so they can never disagree.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_SITE_URL  — set it to pin the real domain (aquiferreachllc.com,
 *     a client domain, or the Vercel project URL, whatever you want canonical to be)
 *  2. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL — Vercel injects these at build
 *     time, so the canonical automatically follows the project's own domain. Rename
 *     the project to `aquiferreachllc` and every URL updates on the next deploy,
 *     with no code change and nothing to remember.
 *  3. The current demo domain as a last resort, so a plain `next build` outside
 *     Vercel still emits absolute URLs that resolve instead of a dead host.
 */
function normalise(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  return /^https?:\/\//i.test(raw) ? raw.replace(/\/+$/, "") : `https://${raw.replace(/\/+$/, "")}`;
}

export const siteUrl =
  normalise(process.env.NEXT_PUBLIC_SITE_URL) ??
  normalise(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  normalise(process.env.VERCEL_URL) ??
  "https://demo-website-well-drilling.vercel.app";
