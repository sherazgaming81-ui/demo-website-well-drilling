"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { projects } from "@/lib/site-data";
import { rv } from "@/lib/use-reveals";

/**
 * The work gallery, with a lightbox that grows out of the tile that was clicked.
 *
 * This is a hand-rolled FLIP rather than the View Transitions API on purpose: the
 * thumbnail is still in the page while the lightbox is open, so giving both the
 * same view-transition-name made the browser abort the transition and log
 * "Unexpected duplicate view-transition-name" on every open. Measuring the tile and
 * animating the lightbox from that rect is a few lines, never conflicts, and works
 * in every engine instead of only the ones with the API.
 */
export function WorkGallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const figureRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);


  const open = (index: number, tile: HTMLElement | null) => {
    returnTo.current = tile;
    const from = tile?.querySelector("img")?.getBoundingClientRect();
    setOpenIndex(index);
    if (!from) return;
    requestAnimationFrame(() => {
      const el = figureRef.current?.querySelector("img");
      if (!el || typeof el.animate !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const to = el.getBoundingClientRect();
      if (!to.width || !to.height) return;
      el.animate(
        [
          {
            transform: `translate(${to.left ? from.left - to.left : 0}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
            borderRadius: "10px",
          },
          { transform: "none", borderRadius: "14px" },
        ],
        { duration: 420, easing: "cubic-bezier(.22,.61,.36,1)" },
      );
    });
  };

  /** one helper for both the arrow keys and the on-screen controls */
  function step(delta: number) {
    setOpenIndex((index) => {
      const current = index ?? 0;
      return (current + delta + projects.length) % projects.length;
    });
  }

  function close() {
    setOpenIndex(null);
    // focus goes back where it came from, or a keyboard user is left at the top of the page
    window.setTimeout(() => returnTo.current?.focus({ preventScroll: true }), 40);
  }

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === "ArrowRight") setOpenIndex((index) => ((index ?? 0) + 1) % projects.length);
      if (event.key === "ArrowLeft") setOpenIndex((index) => ((index ?? 0) - 1 + projects.length) % projects.length);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [openIndex]);

  const current = openIndex === null ? null : { ...projects[openIndex], index: openIndex };

  return (
    <>
      <div className="work-grid">
        {projects.map((project, index) => (
          <figure className="work-tile" key={project.image} {...rv(index)}>
            <button
              type="button"
              onClick={(event) => open(index, event.currentTarget.parentElement)}
              aria-label={`Open photo: ${project.caption}`}
            >
              <Image data-parallax="" style={{ "--pa": "8px" } as never} src={project.image} alt={project.alt} fill sizes="(max-width: 760px) 100vw, 30vw" />
              <span className="work-zoom-hint" aria-hidden="true"><Icon name="arrow-up-right" size={14} /></span>
            </button>
            <figcaption>{project.caption}</figcaption>
          </figure>
        ))}
      </div>

      {current && (
        <div className="work-lightbox" role="dialog" aria-modal="true" aria-label={current.caption} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
          <figure className="work-lightbox-figure" ref={figureRef as never}>
            <Image src={current.image} alt={current.alt} width={1400} height={1050} priority sizes="min(1100px, 92vw)" />
            <figcaption>{current.caption}</figcaption>
          </figure>
          <div className="work-lightbox-bar">
            <span>{current.index + 1} / {projects.length}</span>
            <div>
              <button type="button" className="icon-button" aria-label="Previous photo" onClick={() => step(-1)}>
                <Icon name="chevron-left" size={18} />
              </button>
              <button type="button" className="icon-button" aria-label="Next photo" onClick={() => step(1)}>
                <Icon name="chevron-right" size={18} />
              </button>
              <button type="button" className="icon-button" ref={closeRef} aria-label="Close photo" onClick={close}>
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
