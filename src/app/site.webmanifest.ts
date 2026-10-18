import type { MetadataRoute } from "next";
import { business } from "@/lib/site-data";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: business.name,
    short_name: business.shortName,
    description: `${business.tagline} in ${business.city} — repair, installation, gas and servicing with a free inspection.`,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f9fc",
    theme_color: "#0f7fb8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
