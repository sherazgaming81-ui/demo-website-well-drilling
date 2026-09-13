import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aquifer Well Co. | Good Water. From the Ground Up.",
  description: "Expert water well drilling for your home, farm, and business. Explore residential wells, agricultural water systems, and well care. Book your free, no-obligation demonstration.",
  applicationName: "Aquifer Well Co.",
  openGraph: {
    title: "Reliable water. From the ground up. | Aquifer Well Co.",
    description: "Deep expertise. Honest advice. Your free well-drilling demonstration starts here.",
    type: "website",
    locale: "en_US",
    images: [{ url: "/images/well-drilling-hero.jpg", width: 928, height: 1152, alt: "Aquifer water well drilling in the American countryside" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f9f6" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
