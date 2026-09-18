"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Scroll reveals, done with one observer for the whole page so no component has
 * to own its own state. Elements opt in with `data-reveal` and are marked
 * visible with `data-shown` — deliberately not a class, because React rewrites
 * `className` on every re-render and would wipe the marker, leaving sections
 * faded out after a dialog closes.
 *
 * The CSS hides elements only while <html> carries the `js-reveal` class, so
 * nothing can get stuck invisible if JavaScript is off or fails to run.
 */
export function useReveals(deps: unknown[] = []) {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-shown])"));
    if (!nodes.length) return;

    if (!("IntersectionObserver" in window)) {
      for (const node of nodes) node.setAttribute("data-shown", "");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0.05 },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Reveal props: `rv(2)` staggers that element 80ms after its siblings. */
export function rv(index = 0, style: Record<string, string | number> = {}) {
  return {
    "data-reveal": "",
    style: { "--rd": `${index * 80}ms`, ...style } as unknown as CSSProperties,
  };
}

/**
 * Drives two page-level effects with a single rAF-throttled listener:
 * a --scroll fraction for the header progress line, and a compact header once
 * the page actually starts moving.
 */
export function useScrollFx() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      doc.style.setProperty("--scroll", max > 0 ? String(Math.min(1, Math.max(0, doc.scrollTop / max))) : "0");
      setScrolled(doc.scrollTop > 28);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return scrolled;
}
