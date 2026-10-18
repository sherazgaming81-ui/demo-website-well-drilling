"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True when the device has a real hover pointer AND the window is wide enough for
 * pointer-following effects to be worth painting. Below 861px the cursor is either
 * absent or the layout is too tight for a 460px haze, so it is skipped on both.
 */
export function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (hover: hover) and (min-width: 861px)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

/**
 * Parallax: each [data-parallax] element gets a --py custom property from -1 to 1
 * as it crosses the viewport. One rAF loop for the whole page, and the elements
 * themselves are translated by CSS so React never re-renders while scrolling.
 */
export function useParallax(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    if (!nodes.length) return;

    let frame = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const write = (el: HTMLElement, progress: number) => el.style.setProperty("--py", progress.toFixed(4));

    const measure = () => {
      frame = 0;
      const mid = innerHeight / 2;
      for (const el of nodes) {
        const r = el.getBoundingClientRect();
        const centre = r.top + r.height / 2;
        const span = Math.max(1, (r.height / 2) + mid);
        write(el, Math.max(-1, Math.min(1, (centre - mid) / span)));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      for (const el of nodes) el.style.removeProperty("--py");
    };
  }, [enabled]);
}

/**
 * Returns [refs, activeIndex] for a horizontal row of steps: the index advances as
 * each step crosses the middle of the viewport, which drives the progress rail.
 */
export function useStepRail(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const nodes = refs.current.slice(0, count).filter(Boolean) as HTMLElement[];
    if (nodes.length < 2) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = nodes.indexOf(entry.target as HTMLElement);
          if (index > -1) setActive((current) => (current === index ? current : index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  const setRef = (index: number) => (el: HTMLElement | null) => {
    refs.current[index] = el;
  };
  return { active, setRef };
}
