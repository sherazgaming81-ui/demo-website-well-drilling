import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl } from "@/lib/site-url";
import { jsonLd, localBusinessGraph } from "@/lib/schema";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Freeze Point AC Care | AC Repair & Installation in Karachi",
  description:
    "AC repair, installation, gas charging, jet cleaning and inverter board work across Karachi. Same-day visit, free on-site inspection, written quote before any work starts. Call 0300 555 0142.",
  applicationName: "Freeze Point AC Care",
  authors: [{ name: "Freeze Point AC Care" }],
  creator: "Freeze Point AC Care",
  publisher: "Freeze Point AC Care",
  keywords: [
    "AC repair Karachi",
    "air conditioner installation Karachi",
    "AC gas filling and leak repair",
    "inverter AC repair",
    "AC servicing and jet cleaning",
    "ducted AC maintenance contract Karachi",
  ],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Freeze Point AC Care",
    title: "Freeze Point AC Care | Cold air, on the day you called",
    description:
      "Repair, installation, gas and deep servicing for split, inverter, cassette and ducted air conditioners across Karachi. Free inspection, written quote, 90-day workmanship warranty.",
    // A 1200x630 card built from the brand itself: this is the image that goes on
    // WhatsApp, iMessage and X when somebody pastes the link, so it has to carry the
    // name, the promise and the number — not just a photo.
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Freeze Point AC Care — AC repair, installation and servicing in Karachi. Same-day visit, free inspection, written quote." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Freeze Point AC Care | AC Repair & Installation in Karachi",
    description: "Licensed technicians, genuine parts, 90-day workmanship warranty. Free inspection and a written quote before any work starts.",
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
  category: "air conditioning services",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f9fc" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Set the flag before first paint so revealed elements never flash in. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.className+=' js-reveal'" }} />
        {/* Who and where: one LocalBusiness graph for the whole site, built from site-data. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(localBusinessGraph())} />
      </head>
      <body>
        {children}
        {/* Vercel Web Analytics: counts page views server-side, no cookie banner needed. */}
        <Analytics />
      </body>
    </html>
  );
}
