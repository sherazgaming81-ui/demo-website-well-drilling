import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Breadcrumb, SubpageShell } from "@/components/subpage-shell";
import { business, serviceAreas, services } from "@/lib/site-data";

export const metadata: Metadata = {
  title: `AC repair areas in ${business.city} | ${business.name}`,
  description: `Clifton, DHA, Gulshan-e-Iqbal, North Nazimabad, Malir and Saddar — what actually fails in each, how long the van takes, and what to mention when you call ${business.phoneDisplay}. Free inspection, written quote.`,
  alternates: { canonical: "/areas" },
};

const byId = new Map<string, (typeof services)[number]>(services.map((service) => [service.id, service]));

export default function AreasPage() {
  return (
    <SubpageShell>
      <div className="container sub-inner">
        <Breadcrumb items={[{ label: business.shortName, href: "/" }, { label: "Areas we cover" }]} />

        <section className="sub-hero">
          <p className="eyebrow eyebrow-line">{business.tagline.toUpperCase()} · {business.city.toUpperCase()}</p>
          <h1>Six parts of {business.city}, and what each one does to an air conditioner.</h1>
          <p>
            Karachi is not one climate. A Clifton coil is fighting salt air, a Gulshan balcony is recirculating its own heat, a Malir roof
            is two degrees hotter than the seafront and a Saddar shop runs from opening to close. Same city, different faults — so each
            area page says what we actually find there, what it costs you in time, and what to mention on the phone.
          </p>
          <div className="sub-hero-facts">
            <span><Icon name="clock" size={14} />Same-day visit if we hear from you before 4 pm</span>
            <span><Icon name="map-pin" size={14} />{serviceAreas.length} areas covered, van based off {business.officeAddress.split(",")[3]?.trim() ?? business.city}</span>
            <span><Icon name="shield" size={14} />90-day workmanship warranty, in writing</span>
          </div>
        </section>

        <section className="areas-grid" aria-label="Areas we cover">
          {serviceAreas.map((area) => (
            <Link className="area-card" href={`/areas/${area.slug}`} key={area.slug}>
              <span className="area-card-top">
                <span className="area-card-name">{area.name}</span>
                <Icon name="arrow-up-right" size={18} />
              </span>
              <span className="area-card-label">{area.label}</span>
              <span className="area-card-fact"><Icon name="clock" size={13} />{area.eta}</span>
              <span className="area-card-watch">{area.watchFor}</span>
              <span className="area-card-services">
                {area.services.map((id) => {
                  const service = byId.get(id);
                  return service ? <span className="area-chip" key={id}>{service.title}</span> : null;
                })}
              </span>
            </Link>
          ))}
        </section>

        <section className="sub-band">
          <div>
            <h2>Not sure your area is on the list?</h2>
            <p>
              If it is reachable in {business.city}, it probably is — the six above are just where we spend most of the week. Send your
              area or a five-digit postal code with the request and the office confirms the slot, or call {business.phoneDisplay} and ask.
            </p>
          </div>
          <div className="sub-band-actions">
            <Link className="button button-primary" href="/?book=1">Request a free inspection<Icon name="arrow-right" size={17} /></Link>
            <a className="button button-white" href={business.whatsappHref}><Icon name="whatsapp" size={16} />WhatsApp {business.phoneDisplay}</a>
          </div>
        </section>
      </div>
    </SubpageShell>
  );
}
