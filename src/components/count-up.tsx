"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  to: number;
  /** Anything appended after the number, e.g. "+" or "s". */
  suffix?: string;
  durationMs?: number;
  className?: string;
  "aria-label"?: string;
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from 0 to `to` the first time it scrolls into view. */
export function CountUp({ to, suffix = "", durationMs = 1400, className, ...rest }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      setValue(to);
      return;
    }

    let frame = 0;
    let start = 0;
    const run = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(to * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(run);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        frame = requestAnimationFrame(run);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, durationMs]);

  return (
    <span ref={ref} className={className} {...rest}>
      {value.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}
