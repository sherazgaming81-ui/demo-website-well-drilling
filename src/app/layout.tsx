import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/site-url";
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
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Freeze Point AC Care",
    title: "Freeze Point AC Care | Cold air, on the day you called",
    description:
      "Repair, installation, gas and deep servicing for split, inverter, cassette and ducted air conditioners across Karachi. Free inspection, written quote, 90-day workmanship warranty.",
    images: [{ url: "/images/hero.jpg", width: 928, height: 1152, alt: "A Freeze Point technician servicing an outdoor air conditioner condenser on a Karachi rooftop" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Freeze Point AC Care | AC Repair & Installation in Karachi",
    description: "Licensed technicians, genuine parts, 90-day workmanship warranty. Free inspection and a written quote before any work starts.",
    images: ["/images/hero.jpg"],
  },
  robots: { index: true, follow: true },
  category: "air conditioning services",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f9f6" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Set the flag before first paint so revealed elements never flash in. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.className+=' js-reveal'" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
