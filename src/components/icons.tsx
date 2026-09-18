import type { ReactNode } from "react";

export type IconName = "arrow-right" | "arrow-up-right" | "arrow-down" | "phone" | "check" | "shield" | "clock" | "droplet" | "menu" | "close" | "chevron-down" | "chevron-left" | "chevron-right" | "plus" | "minus" | "map-pin" | "calendar" | "sprout" | "home" | "wrench" | "message" | "ruler" | "file-check" | "lock" | "mail" | "star" | "download";

const paths: Record<IconName, ReactNode> = {
  "arrow-right": <><path d="M4 12h15M13 5l7 7-7 7" /></>,
  "arrow-up-right": <><path d="M6 18 18 6M6 6h12v12" /></>,
  "arrow-down": <><path d="M12 4v16m-7-7 7 7 7-7" /></>,
  phone: <path d="m7.5 3 3 5-2.3 2.3a16 16 0 0 0 5.5 5.5l2.3-2.3 5 3c.2.1.4.5.3.8-.5 2.2-2.3 3.8-4.6 3.4A18.6 18.6 0 0 1 3.3 7.3C2.9 5 4.5 3.2 6.7 2.7c.3-.1.7.1.8.3Z" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  droplet: <><path d="M12 2S4.5 10.2 4.5 15a7.5 7.5 0 0 0 15 0C19.5 10.2 12 2 12 2Z" /><path d="M8 16a4 4 0 0 0 4 3" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 5-7 7 7 7" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  plus: <path d="M5 12h14M12 5v14" />,
  minus: <path d="M5 12h14" />,
  "map-pin": <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18m-13 4h2m4 0h2m-8 3h2" /></>,
  sprout: <><path d="M12 21V11M12 15C4 15 3 10 3 5c5 0 9 2 9 7M12 11c0-6 4-8 9-8 0 6-3 9-9 9" /></>,
  home: <><path d="m3 10 9-7 9 7M5 9v12h14V9" /><path d="M9 21v-8h6v8" /></>,
  wrench: <path d="M21 6a6 6 0 0 1-8 7L6 20a2.1 2.1 0 0 1-3-3l7-7a6 6 0 0 1 7-8l-4 4 4 4 4-4Z" />,
  message: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-5 2V7.5A5.5 5.5 0 0 1 8.5 2h4a8.5 8.5 0 0 1 8.5 9.5Z" /><path d="M7 8h9M7 12h6" /></>,
  ruler: <><path d="m3 16 13-13 5 5L8 21l-5-5Z" /><path d="m12 7 2 2m-6 2 2 2m-6 2 2 2" /></>,
  "file-check": <><path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-7-7Z" /><path d="M14 2v7h7m-14 6 3 3 6-6" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  star: <path d="m12 2.5 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.2-6 3.2 1.2-6.7-4.9-4.7 6.7-1 3-6.1Z" fill="currentColor" stroke="none" />,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5" /></>,
};

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

export function BrandMark({ className = "" }: { className?: string }) {
  // One file, two jobs: this is the favicon (src/app/icon.svg) rendered in the page, so
  // the tab icon and the brand mark can never drift apart. next/image refuses SVG
  // without dangerouslyAllowSVG, and a 1.5 kB mark needs no optimiser.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`brand-mark${className ? ` ${className}` : ""}`} src="/icon.svg" alt="" width={64} height={64} draggable={false} />;
}

export function Brand({ light = false }: { light?: boolean }) {
  return <a href="#top" className={`brand ${light ? "brand-light" : ""}`} aria-label="Aquifer Reach LLC home"><BrandMark /><span className="brand-type"><span className="brand-word">aquifer reach</span><span className="brand-sub">WELL DRILLING CO.</span></span></a>;
}

export function Stars({ size = 13 }: { size?: number }) {
  return <span className="stars" aria-label="5 out of 5 stars">{Array.from({ length: 5 }, (_, index) => <Icon key={index} name="star" size={size} />)}</span>;
}

export function Contours({ className = "" }: { className?: string }) {
  // The outer group centres, the rotor drifts, and every ring breathes on its
  // own offset so the contour lines read like a live topographic survey.
  return <svg className={`contours ${className}`} viewBox="0 0 640 520" fill="none" aria-hidden="true"><g transform="translate(320 260)"><g className="contours-rotor">{Array.from({ length: 13 }, (_, index) => <g key={index} className="contours-ring" style={{ animationDelay: `${index * -0.7}s` }}><g transform={`scale(${0.55 + index * 0.2})`}><path d="M-102-40C-98-104-24-100 21-73S113-76 135-15 100 76 34 82-94 107-110 50-110-7-102-40Z" stroke="currentColor" strokeWidth="0.9" /></g></g>)}</g></g></svg>;
}
