import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup, BrandMark, Icon } from "@/components/icons";
import { business } from "@/lib/site-data";

/**
 * The chrome the extra routes (/areas and its children) wear. Same header and
 * footer classes as the home page and the same logo file, so a locality page
 * cannot look like a different website — with one deliberate difference: the
 * brand here links to the real home page, not to the "#top" anchor the home
 * header uses, which would be a dead link on any other route.
 */
export function SubpageHeader() {
  return (
    <header className="site-header sub-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label={`${business.name} home`}>
          <BrandLockup />
          <span className="brand-fallback" aria-hidden="true"><BrandMark /></span>
        </Link>
        <nav className="sub-nav" aria-label="Site sections">
          <Link href="/areas" aria-current="page">Areas we cover</Link>
          <Link href="/assistant">Ask the assistant</Link>
        </nav>
        <div className="header-actions">
          <a className="header-phone" href={business.phoneHref}><Icon name="phone" size={16} /><span>{business.phoneDisplay}</span></a>
          <Link className="button button-primary header-cta" href="/?book=1"><span className="desktop-label">Request a free inspection</span><span className="mobile-label">Inspect</span><Icon name="arrow-up-right" size={17} /></Link>
        </div>
      </div>
    </header>
  );
}

export function SubpageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <SubpageHeader />
      <main id="main-content">{children}</main>
      <SubpageFooter />
    </>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="sub-crumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item.label}>
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          {index < items.length - 1 && <Icon name="chevron-right" size={11} />}
        </span>
      ))}
    </nav>
  );
}

export function SubpageFooter() {
  return (
    <footer className="site-footer sub-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link href="/" className="brand" aria-label={`${business.name} home`}>
            <BrandLockup />
            <span className="brand-fallback" aria-hidden="true"><BrandMark /></span>
          </Link>
          <p>Honest diagnosis. Genuine parts.<br />Cold air that stays cold.</p>
        </div>
        <div className="footer-column">
          <h3>WHERE WE GO</h3>
          <Link href="/areas">All areas we cover</Link>
          <Link href="/#services">Services</Link>
          <Link href="/#faq">Questions, answered</Link>
          <Link href="/assistant">Chat with the assistant</Link>
        </div>
        <div className="footer-column footer-contact">
          <h3>LET’S TALK</h3>
          <a className="footer-phone" href={business.phoneHref}>{business.phoneDisplay}<Icon name="arrow-up-right" size={16} /></a>
          <a href={business.whatsappHref}><span><Icon name="whatsapp" size={15} />WhatsApp the workshop</span></a>
          <p className="footer-addr">{business.officeAddress}<small>{business.officeNote}</small></p>
          {business.hours.map((hour) => <p key={hour.days} className="footer-hours"><span>{hour.days}</span> {hour.time}</p>)}
        </div>
      </div>
      <div className="container">
        <p className="site-legal-note">Demonstration website built to show a design and build range — {business.name}, its contact details, figures and photography are illustrative, not a live business.</p>
      </div>
    </footer>
  );
}
