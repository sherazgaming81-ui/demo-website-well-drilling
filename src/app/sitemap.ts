import type { MetadataRoute } from "next";
import { serviceAreas } from "@/lib/site-data";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/#services`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/#work`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/#faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/areas`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    // One entry per locality page, all of them generated from the same serviceAreas
    // list the pages themselves are generated from.
    ...serviceAreas.map((area) => ({
      url: `${siteUrl}/areas/${area.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
