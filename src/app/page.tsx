"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BookingDialog } from "@/components/booking-dialog";
import { Brand, BrandMark, Contours, Icon, Stars, type IconName } from "@/components/icons";
import { Modal } from "@/components/modal";
import { faqs, services, testimonials } from "@/lib/site-data";

const navigation = [{ label: "Our services", href: "#services" }, { label: "Why Aquifer", href: "#why-aquifer" }, { label: "How it works", href: "#process" }, { label: "Happy customers", href: "#reviews" }];
const benefits: { icon: IconName; title: string; description: string }[] = [
  { icon: "clock", title: "Quick to respond. Never quick to cut corners.", description: "Your time matters. We keep things moving with prompt communication, dependable scheduling, and a crew that shows up ready." },
  { icon: "shield", title: "Deep experience. Down-to-earth people.", description: "Decades in the field, modern equipment, and real people who explain the details without the industry jargon." },
  { icon: "droplet", title: "A lasting source. A lasting relationship.", description: "We’re here for the first conversation, the final flow test, and the years of good water that follow." },
];
const steps: { icon: IconName; title: string; description: string }[] = [
  { icon: "message", title: "Tell us what’s on your mind.", description: "Book your free demo in about a minute. Tell us a little about your property and what you need from your water." },
  { icon: "ruler", title: "See what’s possible.", description: "Meet a well specialist, explore our process and equipment, and get real answers to your questions." },
  { icon: "file-check", title: "Move forward with confidence.", description: "Get a clear picture of your options, the next steps, and what to expect. No pressure. The next move is yours." },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingService, setBookingService] = useState("");
  const [selectedService, setSelectedService] = useState<(typeof services)[number] | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  const review = testimonials[reviewIndex];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  function openBooking(service = "") {
    setSelectedService(null);
    setMenuOpen(false);
    setBookingService(service);
    setBookingOpen(true);
  }

  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div id="top" />
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">{navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <div className="header-actions"><a className="header-phone" href="tel:+18885550142"><Icon name="phone" size={16} /><span>(888) 555-0142</span></a><button className="button button-primary header-cta" onClick={() => openBooking()}><span className="desktop-label">Book a free demo</span><span className="mobile-label">Free demo</span><Icon name="arrow-up-right" size={17} /></button><button className="menu-toggle icon-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={24} /></button></div>
      </div>
      {menuOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}<Icon name="arrow-up-right" size={16} /></a>)}<a href="#faq" onClick={() => setMenuOpen(false)}>Your questions, answered<Icon name="arrow-up-right" size={16} /></a><a href="tel:+18885550142"><span><Icon name="phone" size={15} />(888) 555-0142</span></a></nav>}
    </header>

    <main id="main-content">
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div className="hero-content">
            <p className="eyebrow eyebrow-line">GOOD WATER STARTS WITH GOOD PEOPLE</p>
            <h1 id="hero-title"><span>Reliable water.</span><span>From the</span><span className="text-blue">ground up.</span></h1>
            <p className="hero-description">Expert well drilling. Honest advice. Dependable water for your home, your land, and everything you’re building.</p>
            <div className="hero-actions"><button className="button button-primary" onClick={() => openBooking()}>Book your free demo<Icon name="arrow-up-right" size={19} /></button><a href="#process" className="process-link"><span className="play-circle"><Icon name="arrow-down" size={14} /></span>See how it works</a></div>
            <div className="hero-reassurance"><Icon name="check" size={13} />No cost. No pressure. Just clear answers.</div>
            <div className="hero-trust"><div className="avatar-stack">{testimonials.map((person) => <Image key={person.name} src={person.image} width={36} height={36} alt="" />)}</div><div><div className="hero-rating"><Stars size={12} /><span><strong>4.9/5</strong> from happy homeowners</span></div><p>1,200+ wells. A whole lot of peace of mind.</p></div></div>
          </div>
          <div className="hero-visual">
            <div className="hero-image"><Image src="/images/well-drilling-hero.jpg" alt="A water well drilling specialist working beside a drill rig on a lush rural American property" fill priority sizes="(max-width: 760px) 100vw, 50vw" /><div className="image-shade" /><span className="image-pill"><span />EXPERTS AT EVERY DEPTH</span><span className="image-caption">YOUR LAND.<br />OUR COMMITMENT.</span></div>
            <div className="hero-note"><span className="hero-note-icon"><Icon name="shield" size={27} /></span><div><strong>Deep roots. Higher standards.</strong><span>Good water. Done right. Since 1998.</span></div><span className="note-dot" /></div>
            <p className="photo-caption"><span />REAL WORK. LASTING IMPACT.</p>
          </div>
        </div>
      </section>

      <section className="trust-bar" aria-label="Aquifer at a glance">
        <div className="container trust-stats">
          <div className="trust-stat"><strong>25<span>+</span></strong><span>Years of hands-on<br />experience</span></div>
          <div className="trust-stat"><strong>1,200<span>+</span></strong><span>Wells drilled.<br />Lives made better.</span></div>
          <div className="trust-stat"><strong>48<span>hr</span></strong><span>Typical response.<br />Because water can’t wait.</span></div>
          <div className="trust-stat"><span className="stat-shield"><Icon name="shield" size={33} /></span><span><b>Built on trust.</b><br />Backed by expertise.</span></div>
        </div>
      </section>

      <section id="services" className="section services-section" aria-labelledby="services-title">
        <div className="container">
          <div className="section-heading"><div><p className="eyebrow eyebrow-line">YOUR WATER. OUR LIFE’S WORK.</p><h2 id="services-title">Every property is different.<br />Our commitment isn’t.</h2></div><p>From your first home to your family farm,<br className="desktop-break" /> we go deeper to find the right solution.</p></div>
          <div className="services-grid">{services.map((service) => <article className="service-card" key={service.id}><div className="service-image"><Image src={service.image} alt={service.alt} fill sizes="(max-width: 760px) 100vw, 33vw" /><span className="service-number">{service.number} / OUR SERVICES</span></div><div className="service-content"><p className="service-category">{service.category}</p><h3>{service.title}</h3><p className="service-description">{service.description}</p><button className="service-link" onClick={() => setSelectedService(service)} aria-label={`Learn more about ${service.title.toLowerCase()}`}>{service.link}<span><Icon name="arrow-up-right" size={17} /></span></button></div></article>)}</div>
          <p className="services-footnote"><Icon name="shield" size={16} />Thoughtfully planned. Professionally drilled. Built to last.</p>
        </div>
      </section>

      <section id="why-aquifer" className="difference-section" aria-labelledby="difference-title">
        <Contours className="difference-contours" />
        <div className="container difference-grid"><div className="difference-intro"><p className="eyebrow eyebrow-line">THE AQUIFER DIFFERENCE</p><h2 id="difference-title">We dig deep.<br />So you can<br /><span>worry less.</span></h2><p>Water is too important for crossed fingers. You deserve a team that knows the ground, respects your time, and stands behind the work.</p><div className="difference-signoff"><BrandMark /><span>More than a well.<br /><strong>A promise to do it right.</strong></span></div></div><div className="benefits">{benefits.map((benefit, index) => <div className="benefit" key={benefit.title}><span className="benefit-icon"><Icon name={benefit.icon} size={24} /></span><div><span className="benefit-number">0{index + 1} / OUR PROMISE</span><h3>{benefit.title}</h3><p>{benefit.description}</p></div></div>)}</div></div>
      </section>

      <section id="process" className="section process-section" aria-labelledby="process-title">
        <div className="container"><div className="center-heading"><p className="eyebrow">LESS GUESSWORK. MORE GOOD WATER.</p><h2 id="process-title">A simple start.<br />A well-informed decision.</h2><p>Big decisions feel smaller when you have the right people beside you.</p></div><div className="process-grid">{steps.map((step, index) => <article className="process-step" key={step.title}><div className="step-top"><span className="process-icon"><Icon name={step.icon} size={25} /></span><span className="step-line" /><span className="process-number">STEP 0{index + 1}</span></div><h3>{step.title}</h3><p>{step.description}</p></article>)}</div><div className="process-bottom"><button className="button button-primary" onClick={() => openBooking()}>Let’s talk about your water<Icon name="arrow-up-right" size={18} /></button><span><Icon name="clock" size={14} />A minute to book. A lifetime of possibilities.</span></div></div>
      </section>

      <section id="reviews" className="reviews-section" aria-labelledby="reviews-title">
        <div className="container reviews-grid"><div className="reviews-intro"><p className="eyebrow eyebrow-line">GOOD WATER. GOOD WORDS.</p><h2 id="reviews-title">The best part?<br />Happy people.</h2><p>Nothing means more than the trust of the people on the other end of the well.</p><div className="reviews-score"><strong>4.9<span>/5</span></strong><div><Stars size={16} /><span>A reputation that runs deep.</span></div></div><div className="review-controls"><button className="icon-button" aria-label="Previous customer story" onClick={() => setReviewIndex((reviewIndex - 1 + testimonials.length) % testimonials.length)}><Icon name="arrow-right" className="rotate-arrow" size={18} /></button><button className="icon-button" aria-label="Next customer story" onClick={() => setReviewIndex((reviewIndex + 1) % testimonials.length)}><Icon name="arrow-right" size={18} /></button><span>0{reviewIndex + 1} <span>/ 0{testimonials.length}</span></span></div></div><div className="testimonial-card" aria-live="polite" aria-atomic="true"><div className="testimonial-top"><span className="quote-mark">“</span><Stars size={14} /></div><h3>{review.highlight}</h3><blockquote>“{review.quote}”</blockquote><div className="review-author"><Image src={review.image} alt="" width={44} height={44} /><div><strong>{review.name}</strong><span>{review.type}</span></div><span className="review-location"><Icon name="map-pin" size={14} />{review.location}</span></div><div className="review-card-bottom"><span>THE AQUIFER EXPERIENCE</span><div className="review-dots">{testimonials.map((item, index) => <button key={item.name} className={index === reviewIndex ? "active" : ""} aria-label={`Read customer story ${index + 1}`} aria-pressed={index === reviewIndex} onClick={() => setReviewIndex(index)} />)}</div></div></div></div>
      </section>

      <section id="faq" className="section faq-section" aria-labelledby="faq-title"><div className="container faq-grid"><div><p className="eyebrow eyebrow-line">CLEAR ANSWERS. RIGHT HERE.</p><h2 id="faq-title">A few good<br />questions.</h2><p className="faq-intro">New to wells? You’re in good company.<br />Let’s get beneath the surface.</p><button className="inline-link" onClick={() => openBooking()}>Have another question? Let’s talk<Icon name="arrow-up-right" size={16} /></button></div><div className="faq-list">{faqs.map((faq, index) => <article className={`faq-item ${openFaq === index ? "is-open" : ""}`} key={faq.question}><h3><button id={`faq-question-${index}`} aria-expanded={openFaq === index} aria-controls={`faq-answer-${index}`} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{faq.question}<span><Icon name={openFaq === index ? "minus" : "plus"} size={17} /></span></button></h3><div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} hidden={openFaq !== index}><p className="faq-answer">{faq.answer}</p></div></article>)}</div></div></section>

      <section className="final-cta" aria-labelledby="cta-title"><div className="container"><div className="cta-panel"><Contours className="cta-contours" /><div><p className="eyebrow">YOUR NEXT CHAPTER STARTS BELOW THE SURFACE.</p><h2 id="cta-title">Good water is closer<br />than you think.</h2></div><div className="cta-action"><button className="button button-white" onClick={() => openBooking()}>Book my free demo<Icon name="arrow-up-right" size={19} /></button><p><Icon name="check" size={13} />Free demo. Zero obligation. Clear answers.</p></div></div></div></section>
    </main>

    <footer className="site-footer"><div className="container"><div className="footer-grid"><div className="footer-brand"><Brand /><p>Deep expertise. Honest work.<br />Good water for generations to come.</p><span className="footer-made"><span />AMERICAN GROUND. AMERICAN GRIT.</span></div><div className="footer-column"><h3>EXPLORE</h3>{navigation.slice(0, 3).map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<a href="#reviews">Happy customers</a><a href="#faq">FAQs</a></div><div className="footer-column"><h3>WHAT WE DO</h3>{services.map((service) => <button key={service.id} onClick={() => setSelectedService(service)}>{service.title}</button>)}<button onClick={() => openBooking()}>Free demonstrations<Icon name="arrow-up-right" size={13} /></button></div><div className="footer-column footer-contact"><h3>LET’S TALK WATER</h3><a className="footer-phone" href="tel:+18885550142">(888) 555-0142<Icon name="arrow-up-right" size={16} /></a><a href="mailto:hello@aquifer.example">hello@aquifer.example</a><p>Monday–Friday · 8 am–5 pm</p><button className="footer-book" onClick={() => openBooking()}>Start a conversation<Icon name="arrow-right" size={16} /></button></div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} Aquifer Well Co. All rights reserved.</p><div><button onClick={() => setLegal("privacy")}>Privacy policy</button><button onClick={() => setLegal("terms")}>Terms of use</button><a href="#top">Back to top<Icon name="arrow-up-right" size={13} /></a></div></div><p className="site-demo-note">A demonstration brand. Experience figures, customer stories, and contact details are illustrative. Images include AI-generated and stock photography.</p></div></footer>

    {bookingOpen && <BookingDialog initialService={bookingService} onClose={() => setBookingOpen(false)} />}
    {selectedService && <Modal onClose={() => setSelectedService(null)} labelledBy="service-dialog-title" className="service-modal"><div className="service-dialog-image"><Image src={selectedService.image} alt={selectedService.alt} fill sizes="680px" /></div><div className="service-dialog-content"><p className="eyebrow">{selectedService.category}</p><h2 id="service-dialog-title">{selectedService.title}</h2><p>{selectedService.detail}</p><h3>A thoughtful, full-service approach</h3><ul>{selectedService.benefits.map((benefit) => <li key={benefit}><span><Icon name="check" size={14} /></span>{benefit}</li>)}</ul><button className="button button-primary" onClick={() => openBooking(selectedService.id)}>Explore your options—free<Icon name="arrow-up-right" size={18} /></button><p className="service-dialog-note">Your demo is a conversation, not a commitment. Coverage and project suitability are confirmed individually.</p></div></Modal>}
    {legal && <Modal onClose={() => setLegal(null)} labelledBy="legal-title" className="legal-modal"><p className="eyebrow">AQUIFER WELL CO. · DEMO WEBSITE</p><h2 id="legal-title">{legal === "privacy" ? "Your privacy matters." : "A few clear ground rules."}</h2>{legal === "privacy" ? <><p>This demonstration collects only the information you enter into the free-demo request form: name, email, phone, property ZIP code, service, preferred date and time, and optional notes.</p><h3>How your information is used</h3><p>Requests are held only in this website’s short-lived in-memory demo store to demonstrate a working booking flow, and are not written to a database. There is no marketing subscription, advertising tracker, or automated email delivery. Please use fictional contact information and never submit sensitive personal data.</p><h3>Your choices</h3><p>The form requires your consent before a request is saved. You can close it without submitting, and no partially completed form is stored on our server. You can download your request summary after submission.</p><h3>About this preview</h3><p>Aquifer Well Co. is a fictional demonstration brand, not an operating drilling business. The listed contact details are placeholders. For removal of submitted demonstration data, contact the person or organization that shared this preview.</p></> : <><p>This website is an interactive demonstration of a water-well drilling business. Aquifer Well Co., the project figures, testimonials, and listed contact details are illustrative.</p><h3>No real appointment or service contract</h3><p>Submitting the form saves a demonstration request. It does not schedule an actual appointment, send an email, create a customer contract, or authorize work. No payment is collected.</p><h3>Property-specific advice</h3><p>General information about wells is not a guarantee of water yield, quality, cost, licensing, or service availability. Actual drilling work requires a qualified local professional, property assessment, and applicable permits.</p><h3>Images and content</h3><p>Imagery is a mix of AI-generated demonstration visuals and stock photography. Customer portraits are illustrative and do not depict actual customers.</p></>}<button className="button button-primary" onClick={() => setLegal(null)}>Got it<Icon name="check" size={17} /></button></Modal>}
  </>;
}
