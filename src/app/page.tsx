"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookingDialog } from "@/components/booking-dialog";
import { ChatWidget } from "@/components/chat-widget";
import { BeforeAfter } from "@/components/before-after";
import { ColdMist } from "@/components/cold-mist";
import { CountUp } from "@/components/count-up";
import { WorkGallery } from "@/components/work-gallery";
import { Brand, BrandMark, Contours, Icon, type IconName } from "@/components/icons";
import { Modal } from "@/components/modal";
import { brands, business, faqs, projects, proofPoints, serviceAreas, services, stats, steps } from "@/lib/site-data";
import { rv, useReveals, useScrollFx } from "@/lib/use-reveals";
import { jsonLd, localBusinessGraph, siteFaqGraph } from "@/lib/schema";
import { useFinePointer, useParallax, useStepRail } from "@/lib/use-motion";

const navigation = [
  { label: "Our services", href: "#services" },
  { label: "Why Freeze Point", href: "#why-freeze-point" },
  { label: "How it works", href: "#process" },
  { label: "Our work", href: "#work" },
];

const promises: { icon: IconName; title: string; description: string }[] = [
  { icon: "shield", title: "Licensed technicians, every brand.", description: "Trained on the units actually sold here — split, inverter, cassette and ducted — with the test gear to prove a fault instead of trading parts at it until something sticks." },
  { icon: "clock", title: "Same-day, when you call early.", description: `Most ${business.city} areas get a visit the same day if we hear from you before 4 pm. May and June book out first, so the earlier you ring, the more say you have over the slot.` },
  { icon: "check", title: "Ninety days, in writing.", description: "Repairs, gas charging and installations carry a 90-day workmanship warranty on the job card, and the part we took out stays with you. If the same fault comes back, we come back." },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  /* One object instead of three flags: the dialog is open when this is set, and an area
     page can hand over both the service and the area in a single update. */
  const [booking, setBooking] = useState<{ service: string; area: string } | null>(null);
  const [selectedService, setSelectedService] = useState<(typeof services)[number] | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  const scrolled = useScrollFx();
  const finePointer = useFinePointer();
  useReveals();
  useParallax(finePointer);
  const rail = useStepRail(steps.length);

  /* An area page links here as /?book=1&area=Clifton&service=ac-gas so the dialog opens
     with the only two things it already knows. Read once, on mount, from window.location
     rather than useSearchParams: the page is prerendered, and this keeps it that way. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("book") !== "1") return;
    const area = (params.get("area") ?? "").slice(0, 60);
    const service = params.get("service") ?? "";
    // Read once from window.location instead of useSearchParams so this page stays
    // prerendered; one state update, and the URL is cleaned so a refresh after closing
    // the dialog does not reopen it.
    // The query string is a one-time handoff from another page, not state to derive.
    // Reading it during render would give the prerendered HTML a different tree than
    // the browser has, and that is a hydration error, so it is set here on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBooking({ service: services.some((item) => item.id === service) ? service : "", area });
    window.history.replaceState(null, "", "/#services");
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  function openBooking(service = "") {
    setSelectedService(null);
    setMenuOpen(false);
    setBooking({ service, area: "" });
  }

  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div id="top" />
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">{navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<Link href="/areas">Areas we cover</Link></nav>
        <div className="header-actions"><a className="header-phone" href={business.phoneHref}><Icon name="phone" size={16} /><span>{business.phoneDisplay}</span></a><button className="button button-primary header-cta" onClick={() => openBooking()}><span className="desktop-label">Request a free inspection</span><span className="mobile-label">Inspect</span><Icon name="arrow-up-right" size={17} /></button><button className="menu-toggle icon-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={24} /></button></div>
      </div>
      {menuOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}<Icon name="arrow-up-right" size={16} /></a>)}<a href="#faq" onClick={() => setMenuOpen(false)}>Questions, answered<Icon name="arrow-up-right" size={16} /></a><Link href="/areas" onClick={() => setMenuOpen(false)}>Areas we cover<Icon name="arrow-up-right" size={16} /></Link><a href={business.whatsappHref}><span><Icon name="whatsapp" size={15} />WhatsApp us</span></a><a href={business.phoneHref}><span><Icon name="phone" size={15} />{business.phoneDisplay}</span></a></nav>}
    </header>

    <main id="main-content">
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div className="hero-content">
            <p className="eyebrow eyebrow-line" {...rv(0)}>{business.name.toUpperCase()} · {business.city.toUpperCase()}</p>
            <h1 id="hero-title"><span {...rv(1)}>Cold air.</span><span {...rv(2)}>on the day</span><span className="text-blue" {...rv(3)}>you called.</span></h1>
            <p className="hero-description" {...rv(4)}>Repair, installation, gas and deep servicing for split, inverter, cassette and ducted air conditioners across {business.city} — inspected first, quoted in writing, then fixed.</p>
            <p className="urdu-line" lang="ur" dir="rtl" {...rv(5)}>ہر گرمی کا ٹھنڈا حل۔</p>
            <div className="hero-actions" {...rv(6)}><button className="button button-primary" onClick={() => openBooking()}>Request a free inspection<Icon name="arrow-up-right" size={19} /></button><a href={business.whatsappHref} className="process-link"><span className="play-circle"><Icon name="whatsapp" size={13} /></span>WhatsApp {business.phoneDisplay}</a></div>
            <div className="hero-reassurance" {...rv(7)}><Icon name="check" size={13} />{business.inspectionLine}</div>
            <div className="thermo" {...rv(8)} aria-label="Typical indoor temperature before and after our visit">
              <div className="thermo-cell is-before"><span>OUTSIDE AT 3 PM</span><strong><CountUp to={43} suffix="°C" aria-label="43 degrees" /></strong></div>
              <span className="thermo-arrow"><Icon name="arrow-right" size={19} /></span>
              <div className="thermo-cell is-after"><span>YOUR ROOM, SAME DAY</span><strong><CountUp to={24} from={43} suffix="°C" aria-label="24 degrees" /></strong></div>
              <span className="thermo-bar" aria-hidden="true"><i /></span>
            </div>
            <div className="hero-trust" {...rv(9)}><div className="avatar-stack">{projects.slice(1, 4).map((project) => <Image key={project.image} src={project.image} width={36} height={36} alt="" />)}</div><div><div className="hero-rating"><Icon name="snowflake" size={13} /><span><strong>{stats[0].value} years</strong> in {business.city} · {stats[1].value.split("+")[0]}+ units</span></div><p>Licensed technicians, genuine parts, and a 90-day workmanship warranty on the job card.</p></div></div>
          </div>
          <div className="hero-visual" {...rv(2)}>
            <div className="hero-image"><Image data-parallax="" style={{ "--pa": "10px" } as never} src="/images/hero.jpg" alt="A Freeze Point technician servicing an outdoor air conditioner condenser on a Karachi rooftop" fill priority sizes="(max-width: 760px) 100vw, 50vw" /><div className="image-shade" /><span className="image-pill"><span />SAME-DAY IN KARACHI</span><span className="image-caption">YOUR HOME.<br />COOLED PROPERLY.</span></div>
            <div className="hero-note"><span className="hero-note-icon"><Icon name="shield" size={27} /></span><div><strong>Tested, not guessed.</strong><span>Readings before and after, on your job card.</span></div><span className="note-dot" /></div>
            <p className="photo-caption"><span />REAL JOBS. KARACHI HEAT.</p>
          </div>
        </div>
      </section>

      <section className="marquee" aria-label="Air conditioner brands we service">
        <div className="marquee-track">{[...brands, ...brands].map((brand, index) => <span className="marquee-item" key={`${brand}-${index}`}>{brand}</span>)}</div>
      </section>

      <section className="trust-bar" aria-label="Freeze Point at a glance">
        <div className="container trust-stats">
          <div className="trust-stat" {...rv(0)}><strong>{stats[0].value.split("+")[0]}<span>+</span></strong><span>Years working<br />in {business.city}</span></div>
          <div className="trust-stat" {...rv(1)}><strong>{stats[1].value}</strong><span>Units serviced, repaired<br />and installed</span></div>
          <div className="trust-stat" {...rv(2)}><strong>Free</strong><span>On-site inspection.<br />Written quote first.</span></div>
          <div className="trust-stat" {...rv(3)}><span className="stat-shield"><Icon name="shield" size={33} /></span><span><b>90-day warranty.</b><br />On workmanship, in writing.</span></div>
        </div>
      </section>

      <section id="services" className="section services-section" aria-labelledby="services-title">
        <div className="container">
          <div className="section-heading"><div {...rv(0)}><p className="eyebrow eyebrow-line">WHAT WE DO</p><h2 id="services-title">Making cold air is easy.<br />Finding the fault isn’t.</h2></div><p>Split, inverter, cassette or ducted —<br className="desktop-break" /> we measure first, then fix what is actually broken.</p></div>
          <div className="services-grid">{services.map((service, index) => <article className="service-card" key={service.id} {...rv(index)}><div className="service-image"><Image data-parallax="" style={{ "--pa": "16px" } as never} src={service.image} alt={service.alt} fill sizes="(max-width: 760px) 100vw, 33vw" /><span className="service-number">{service.number} / OUR SERVICES</span></div><div className="service-content"><p className="service-category">{service.category}</p><h3>{service.title}</h3><p className="service-description">{service.description}</p><button className="service-link" onClick={() => setSelectedService(service)} aria-label={`Learn more about ${service.title.toLowerCase()}`}>{service.link}<span><Icon name="arrow-up-right" size={17} /></span></button></div></article>)}</div>
          <p className="services-footnote" {...rv(6)}><Icon name="shield" size={16} />Inspected, quoted in writing, and tested in front of you.</p>
          <div className="home-areas" {...rv(7)}>
            <span>WHERE WE WORK</span>
            {serviceAreas.map((area) => <Link href={`/areas/${area.slug}`} key={area.slug}>{area.name}<Icon name="chevron-right" size={13} /></Link>)}
            <Link href="/areas">All areas<Icon name="arrow-right" size={13} /></Link>
          </div>
        </div>
      </section>

      <section id="why-freeze-point" className="difference-section" aria-labelledby="difference-title">
        <Contours className="difference-contours" />
        <div className="container difference-grid"><div className="difference-intro" {...rv(0)}><p className="eyebrow eyebrow-line">WHY FREEZE POINT</p><h2 id="difference-title">{business.city}’s heat<br />breaks ACs fast.<br /><span>We fix them properly.</span></h2><p>Dust, salt air and 45-degree afternoons are a different job to a mild-climate install. So we work the way this city needs: test before touching, replace only what failed, and leave the readings on paper.</p><ul className="proof-list">{proofPoints.map((point, index) => <li key={point} {...rv(index)}><Icon name="check" size={14} />{point}</li>)}</ul><div className="difference-signoff"><BrandMark /><span>More than a cold room.<br /><strong>A unit that stays cold.</strong></span></div></div><div className="benefits">{promises.map((promise, index) => <div className="benefit" key={promise.title} {...rv(index)}><span className="benefit-icon"><Icon name={promise.icon} size={24} /></span><div><span className="benefit-number">0{index + 1} / OUR PROMISE</span><h3>{promise.title}</h3><p>{promise.description}</p></div></div>)}</div></div>
      </section>

      <section id="process" className="section process-section" aria-labelledby="process-title">
        <div className="container"><div className="center-heading" {...rv(0)}><p className="eyebrow">LESS GUESSWORK. MORE COLD AIR.</p><h2 id="process-title">A short call.<br />A room that stays cold.</h2><p>Big repair bills feel smaller when you know what is wrong before anyone starts.</p></div><div className="process-rail" aria-hidden="true">{steps.map((step, index) => <i key={step.title} className={rail.active >= index ? "is-on" : ""} />)}</div><div className="process-grid">{steps.map((step, index) => <article ref={rail.setRef(index)} className={`process-step${rail.active === index ? " is-active" : ""}`} key={step.title} {...rv(index)}><div className="step-top"><span className="process-icon"><Icon name={step.icon} size={25} /></span><span className="step-line" /><span className="process-number">STEP 0{index + 1}</span></div><h3>{step.title}</h3><p>{step.description}</p></article>)}</div><div className="process-bottom"><button className="button button-primary" onClick={() => openBooking()}>Request my free inspection<Icon name="arrow-up-right" size={18} /></button><span><Icon name="clock" size={14} />Monday–Saturday 9 am–9 pm · Sunday emergency call-out</span></div></div>
      </section>

      <section id="work" className="reviews-section" aria-labelledby="work-title">
        <div className="container reviews-grid work-row"><div className="reviews-intro" {...rv(0)}><p className="eyebrow eyebrow-line">OUR WORK</p><h2 id="work-title">Real jobs.<br />Karachi heat.</h2><p>Rooftop condensers at 3 pm, choked coils, boards on the bench and new units levelled on a wall. A look at recent work across the city.</p><div className="reviews-score"><strong>{stats[1].value}</strong><div><span>Units serviced since {business.established}</span><span>{stats[2].value} warranty on workmanship</span></div></div></div><WorkGallery /></div>
      </section>

      <section className="section ba-wrap" aria-labelledby="ba-title">
        <div className="container ba-section">
          <div {...rv(0)}>
            <p className="eyebrow eyebrow-line">WHAT A SERVICE ACTUALLY DOES</p>
            <h2 id="ba-title">Same unit.<br />Two different machines.</h2>
            <p>A choked coil and a clean one are the same AC on paper, and nothing like it on your meter. Drag the handle — the dust is the whole story.</p>
            <p className="ba-note"><Icon name="check" size={13} />Illustrative images on this demonstration site; a real report comes with your own unit&apos;s readings.</p>
          </div>
          <BeforeAfter
            before="/images/coil-dirty.jpg"
            after="/images/coil-clean.jpg"
            beforeAlt="A wall-split indoor unit with dust-caked coils, a grimy blower wheel and a dirty filter"
            afterAlt="The same wall-split indoor unit after jet cleaning, with bright clean fins and a white blower wheel"
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(siteFaqGraph())} />
      <section id="faq" className="section faq-section" aria-labelledby="faq-title"><div className="container faq-grid"><div {...rv(0)}><p className="eyebrow eyebrow-line">CLEAR ANSWERS. RIGHT HERE.</p><h2 id="faq-title">Questions we get<br />every summer.</h2><p className="faq-intro">Never had an AC serviced? You’re in good company.<br />Let’s get beneath the surface.</p><button className="inline-link" onClick={() => openBooking()}>Something not covered here? Ask us with your request<Icon name="arrow-up-right" size={16} /></button></div><div className="faq-list">{faqs.map((faq, index) => <article className={`faq-item ${openFaq === index ? "is-open" : ""}`} key={faq.question} {...rv(index)}><h3><button id={`faq-question-${index}`} aria-expanded={openFaq === index} aria-controls={`faq-answer-${index}`} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{faq.question}<span><Icon name={openFaq === index ? "minus" : "plus"} size={17} /></span></button></h3><div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} hidden={openFaq !== index}><p className="faq-answer">{faq.answer}</p></div></article>)}</div></div></section>

      <section className="final-cta" aria-labelledby="cta-title"><div className="container"><div className="cta-panel" {...rv(0)}><Contours className="cta-contours" /><div><p className="eyebrow">{business.city.toUpperCase()} · MON–SAT 9 AM–9 PM</p><h2 id="cta-title">Summer doesn’t queue.<br />Neither do we.</h2></div><div className="cta-action"><button className="button button-white" onClick={() => openBooking()}>Request my free inspection<Icon name="arrow-up-right" size={19} /></button><p><Icon name="check" size={13} />Free inspection. Written quote. 90-day warranty.</p></div></div></div></section>
    </main>

    <footer className="site-footer"><div className="container"><div className="footer-grid"><div className="footer-brand" {...rv(0)}><Brand /><p>Honest diagnosis. Genuine parts.<br />Cold air that stays cold.</p><span className="footer-made"><span />MEASURED, NOT GUESSED.</span></div><div className="footer-column" {...rv(1)}><h3>EXPLORE</h3>{navigation.slice(0, 3).map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<a href="#work">Our work</a><Link href="/areas">Areas we cover</Link><a href="#faq">FAQs</a></div><div className="footer-column" {...rv(2)}><h3>WHAT WE DO</h3>{services.map((service) => <button key={service.id} onClick={() => setSelectedService(service)}>{service.title}</button>)}<button onClick={() => openBooking()}>Free on-site inspections<Icon name="arrow-up-right" size={13} /></button></div><div className="footer-column footer-contact" {...rv(3)}><h3>LET’S TALK</h3><a className="footer-phone" href={business.phoneHref}>{business.phoneDisplay}<Icon name="arrow-up-right" size={16} /></a><a href={business.whatsappHref}>WhatsApp the workshop<Icon name="whatsapp" size={15} /></a><a className="footer-phone is-landline" href={business.landlineHref}>{business.landlineDisplay}</a><p className="footer-addr">{business.officeAddress}<small>{business.officeNote}</small></p>{business.hours.map((hour) => <p key={hour.days} className="footer-hours"><span>{hour.days}</span> {hour.time}</p>)}<button className="footer-book" onClick={() => openBooking()}>Request an inspection<Icon name="arrow-right" size={16} /></button></div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} {business.name}. All rights reserved.</p><div><button onClick={() => setLegal("privacy")}>Privacy policy</button><button onClick={() => setLegal("terms")}>Terms of use</button><a href="#top">Back to top<Icon name="arrow-up-right" size={13} /></a></div></div><p className="site-legal-note">Demonstration website built to show a design and build range — {business.name}, its contact details, figures and photography are illustrative, not a live business. On a real build this is where a licensed contractor’s licence number, NTN and physical address would sit.</p></div></footer>

    {booking && <BookingDialog initialService={booking.service} initialArea={booking.area} onClose={() => setBooking(null)} />}
    <ChatWidget onBook={(serviceId) => openBooking(serviceId ?? "")} />
    <ColdMist />
    {selectedService && <Modal onClose={() => setSelectedService(null)} labelledBy="service-dialog-title" className="service-modal"><div className="service-dialog-image"><Image src={selectedService.image} alt={selectedService.alt} fill sizes="680px" /></div><div className="service-dialog-content"><p className="eyebrow">{selectedService.category}</p><h2 id="service-dialog-title">{selectedService.title}</h2><p>{selectedService.detail}</p><h3>What working with us looks like</h3><ul>{selectedService.benefits.map((benefit) => <li key={benefit}><span><Icon name="check" size={14} /></span>{benefit}</li>)}</ul><button className="button button-primary" onClick={() => openBooking(selectedService.id)}>Request an inspection for this<Icon name="arrow-up-right" size={18} /></button><p className="service-dialog-note">The visit is free and the quote is written before any work starts. Access to the outdoor unit or roof, and power to the indoor unit, make the inspection quicker.</p></div></Modal>}
    {legal && <Modal onClose={() => setLegal(null)} labelledBy="legal-title" className="legal-modal"><p className="eyebrow">{business.name.toUpperCase()} · {legal === "privacy" ? "PRIVACY" : "TERMS"}</p><h2 id="legal-title">{legal === "privacy" ? "Your privacy matters." : "A few clear ground rules."}</h2>{legal === "privacy" ? <><p>The inspection request collects only what we need to reach you and come out: name, phone, email, your area or postal code, which service you want, a preferred date and time, and any notes you add.</p><h3>How it is used</h3><p>To book the visit and prepare for it. Nothing is sold, shared with advertisers or added to a marketing list, and this site carries no advertising trackers or analytics scripts.</p><h3>The chat box</h3><p>The conversation you have with the assistant is kept in this browser tab only, so a reload does not throw away a half-finished request. The reply chime and the tab count are also this-device only: the on/off choice is one flag in local storage, and “Turn reply chime off” in the chat’s ⋯ menu sets it back. It is not sent anywhere, is cleared when you close the tab, and “Start a new chat” in the chat menu clears it on the spot.</p><h3>Where it is stored</h3><p>If the owner has connected an inbox, CRM or storage service, requests are delivered there so a person can follow up. Otherwise they are held only in the web server’s short-lived memory and disappear when it restarts. Please don’t send sensitive personal or financial information.</p><h3>Your choices</h3><p>Nothing is recorded until you press submit, and a half-finished form is never stored. To have a request deleted, call {business.phoneDisplay} and we will handle it.</p><h3>On this demonstration build</h3><p>This is a portfolio site: the brand, numbers and photography are illustrative, so please don’t send a real address or personal details through this form.</p></> : <><p>This website gives general information about air-conditioning repair, installation and maintenance in {business.city}.</p><h3>Inspections and quotes</h3><p>The on-site inspection is free and does not commit you to anything. Work starts only after you approve a written quote. Anything quoted before a visit is an estimate, not a fixed price.</p><h3>What a warranty covers</h3><p>The 90-day warranty covers our workmanship — the repair, the joint, the charge, the bracket — with the parts warranty passed through from whoever made the part. It does not cover a different fault appearing elsewhere, supply voltage damage, or a unit whose filters were never cleaned.</p><h3>Realistic expectations</h3><p>No technician can guarantee a cooling capacity, a power-bill figure or how long a compressor will last. What we can do is test it, show you the readings, and tell you honestly when a unit is past being worth repairing.</p><h3>Availability</h3><p>Same-day visits depend on crew routes and the season. A submitted request confirms your interest, not a booked slot — we call to confirm the time.</p></>}<button className="button button-primary" onClick={() => setLegal(null)}>Got it<Icon name="check" size={17} /></button></Modal>}
  </>;
}
