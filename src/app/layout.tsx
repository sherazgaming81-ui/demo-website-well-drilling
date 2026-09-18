import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Aquifer Reach LLC | Water Well Drilling in Jacksonville, FL",
  description:
    "Licensed and insured water well drilling, pump installation and well abandonment across Northeast Florida. Rock, screen, artesian and salt & pepper wells, with permitting handled. Free on-site estimate — call (904) 477-9809.",
  applicationName: "Aquifer Reach LLC",
  authors: [{ name: "Aquifer Reach LLC" }],
  creator: "Aquifer Reach LLC",
  publisher: "Aquifer Reach LLC",
  keywords: [
    "water well drilling Jacksonville",
    "well drilling Florida",
    "rock well",
    "screen well",
    "artesian well",
    "well pump installation",
    "well abandonment Florida",
    "licensed well contractor Northeast Florida",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Aquifer Reach LLC",
    title: "Aquifer Reach LLC | Your water starts right here",
    description:
      "Professional water well drilling, pump installation and maintenance for residential and commercial properties across Northeast Florida. Family-owned since 2017. Free on-site estimates.",
    images: [{ url: "/images/well-drilling-hero.jpg", width: 928, height: 1152, alt: "Two Aquifer Reach drilling rigs rigged up on a sand job site near Jacksonville, Florida" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aquifer Reach LLC | Water Well Drilling in Jacksonville, FL",
    description: "Licensed, insured and local since 2017. Rock, screen, artesian and salt & pepper wells. Free on-site estimate.",
    images: ["/images/well-drilling-hero.jpg"],
  },
  robots: { index: true, follow: true },
  category: "water well drilling",
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
