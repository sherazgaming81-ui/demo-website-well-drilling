import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { Breadcrumb, SubpageShell } from "@/components/subpage-shell";
import { business, serviceAreas, services } from "@/lib/site-data";
import { areaGraph, jsonLd } from "@/lib/schema";

const bySlug = new Map<string, (typeof serviceAreas)[number]>(serviceAreas.map((area) => [area.slug, area]));
const byId = new Map<string, (typeof services)[number]>(services.map((service) => [service.id, service]));

function areaOr404(slug: string) {
  const area = bySlug.get(slug);
  if (!area) notFound();
  return area;
}

export function generateStaticParams() {
  return serviceAreas.map((area) => ({ area: area.slug }));
}

type Props = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { area: slug } = await params;
  const area = bySlug.get(slug);
  if (!area) return { title: `Area not found | ${business.name}`, robots: { index: false, follow: false } };
  const title = `AC repair in ${area.name}, ${business.city} | ${business.name}`;
  const description = `${area.label} — ${area.intro.split(". ")[0]}. ${business.inspectionLine} Call ${business.phoneDisplay}.`;
  const images = [{ url: "/og.jpg", width: 1200, height: 630, alt: `${business.name} — ${business.tagline} in ${area.name}, ${business.city}` }];
  /* openGraph and twitter are replaced wholesale, not merged, the moment a page sets
     them: without the image repeated here, an area page shared to WhatsApp arrives with
     no picture at all. The smoke test asserts the tag is there for exactly that reason. */
  return {
    title,
    description,
    alternates: { canonical: `/areas/${area.slug}` },
    openGraph: { title, description, url: `/areas/${area.slug}`, type: "article", images },
    twitter: { card: "summary_large_image", title, description, images: ["/og.jpg"] },
  };
}

export default async function AreaPage({ params }: Props) {
  const { area: slug } = await params;
  const area = areaOr404(slug);
  const bookHref = `/?book=1&area=${encodeURIComponent(area.name)}`;

  return (
    <SubpageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(areaGraph(area))} />
      <div className="container sub-inner">
        <Breadcrumb
          items={[
            { label: business.shortName, href: "/" },
            { label: "Areas we cover", href: "/areas" },
            { label: area.name },
          ]}
        />

        <section className="sub-hero">
          <p className="eyebrow eyebrow-line">{business.tagline.toUpperCase()} · {area.name.toUpperCase()}</p>
          {/* The place name is one unit on its own line: letting it wrap left an
              orphaned ", Karachi" hanging under the sentence. */}
          <h1>
            AC repair, installation and servicing in<br />
            <span>{area.name}, {business.city}</span>
          </h1>
          <p>{area.intro}</p>
          <div className="sub-hero-facts">
            <span><Icon name="clock" size={14} />{area.eta}</span>
            <span><Icon name="map-pin" size={14} />{area.blocks}</span>
            <span><Icon name="phone" size={14} />{business.phoneDisplay}</span>
          </div>
          <div className="sub-hero-actions">
            <Link className="button button-primary" href={bookHref}>Request a free inspection<Icon name="arrow-right" size={17} /></Link>
            <a className="button button-white" href={business.whatsappHref}><Icon name="whatsapp" size={16} />WhatsApp the workshop</a>
          </div>
        </section>

        <section className="area-facts" aria-label={`What to expect in ${area.name}`}>
          <div>
            <h2><Icon name="wrench" size={17} />What we find most in {area.name}</h2>
            <p>{area.watchFor}</p>
          </div>
          <div>
            <h2><Icon name="shield" size={17} />Access, and what that means for your slot</h2>
            <p>{area.access}</p>
          </div>
        </section>

        <section className="area-services" aria-label="Booked most in this area">
          <h2>Booked most in {area.name}</h2>
          <div className="area-services-grid">
            {area.services.map((id) => {
              const service = byId.get(id);
              if (!service) return null;
              return (
                <article className="area-service" key={id}>
                  <span className="area-service-number">{service.number} · {service.category}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <Link href={`/?book=1&area=${encodeURIComponent(area.name)}&service=${id}`}>
                    {service.link}<Icon name="arrow-right" size={14} />
                  </Link>
                </article>
              );
            })}
          </div>
          <p className="area-services-note">
            The full list of what we do, with what each job includes, is on the <Link href="/#services">services page</Link>.
          </p>
        </section>

        <section className="area-faq" aria-label={`Questions from ${area.name} customers`}>
          <h2>Asked by people in {area.name}</h2>
          {area.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}<Icon name="plus" size={15} /></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>

        <section className="area-nearby" aria-label="Nearby areas">
          <h2>Nearby</h2>
          <div className="area-nearby-row">
            {area.nearby.map((slug) => {
              const near = bySlug.get(slug);
              if (!near) return null;
              return (
                <Link className="area-nearby-link" href={`/areas/${near.slug}`} key={slug}>
                  {near.name}<Icon name="chevron-right" size={13} />
                </Link>
              );
            })}
            <Link className="area-nearby-link is-all" href="/areas">All areas<Icon name="chevron-right" size={13} /></Link>
          </div>
        </section>

        <section className="sub-band">
          <div>
            <h2>{business.headline}</h2>
            <p>
              {business.inspectionLine} We hold a {area.name.toLowerCase()} slot for today if the request reaches us before 4 pm —
              {" "}{business.hours[0].days.toLowerCase()} are {business.hours[0].time.toLowerCase()}, Sunday is emergency call-out only.
            </p>
          </div>
          <div className="sub-band-actions">
            <Link className="button button-primary" href={bookHref}>Request a free inspection<Icon name="arrow-right" size={17} /></Link>
            <a className="button button-white" href={business.phoneHref}><Icon name="phone" size={16} />{business.phoneDisplay}</a>
          </div>
        </section>
      </div>
    </SubpageShell>
  );
}
