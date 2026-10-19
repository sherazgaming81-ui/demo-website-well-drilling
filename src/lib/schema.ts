import { business, faqs, serviceAreas, services } from "@/lib/site-data";
import { siteUrl } from "@/lib/site-url";

/**
 * Structured data, generated from the same site-data the pages are built from, so
 * what Google is told and what a visitor reads cannot drift apart.
 *
 * Deliberately absent: aggregateRating (no verified review source yet), priceRange
 * and any offer - this business quotes after an inspection, and a schema price hint
 * would be exactly the thing the page promises never to publish.
 */

const phone = business.phoneHref.replace(/^tel:/, "");
const street = business.officeAddress.replace(/,\s*Karachi.*$/, "");

/** Days the shop is open for walk-ins. Sunday is emergency call-out only, which is
 *  not an opening hour, so it stays out of the schema instead of being guessed at. */
const openDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function localBusinessGraph() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: business.name,
    description: `${business.tagline} in ${business.city}. ${business.inspectionLine}`,
    url: `${siteUrl}/`,
    telephone: phone,
    image: `${siteUrl}/mark.webp`,
    logo: `${siteUrl}/logo.webp`,
    foundingDate: String(business.established),
    address: {
      "@type": "PostalAddress",
      streetAddress: street,
      addressLocality: business.city,
      postalCode: business.postalCode,
      addressCountry: "PK",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: openDays,
        opens: "09:00",
        closes: "21:00",
      },
    ],
    areaServed: serviceAreas.map((area) => ({
      "@type": "AdministrativeArea",
      name: `${area.name}, ${business.city}`,
    })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${business.tagline}`,
      itemListElement: services.map((service) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: service.title, description: service.description },
      })),
    },
  };
}

export function siteFaqGraph() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function areaGraph(area: (typeof serviceAreas)[number]) {
  const url = `${siteUrl}/areas/${area.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `${business.tagline} in ${area.name}`,
        description: area.intro,
        url,
        serviceType: services.map((service) => service.title),
        provider: { "@id": `${siteUrl}/#business` },
        areaServed: {
          "@type": "AdministrativeArea",
          name: `${area.name}, ${business.city}`,
          description: area.blocks,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: area.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: business.name, item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: "Areas we cover", item: `${siteUrl}/areas` },
          { "@type": "ListItem", position: 3, name: area.name, item: url },
        ],
      },
    ],
  };
}

/** One <script> tag's worth of text, with "<" escaped so nothing on the page can
 *  close the tag early by containing a string that looks like markup. */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</gu, "\\u003c") };
}
