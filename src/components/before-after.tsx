"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  /** Shown for a moment when the slider first scrolls into view. */
  nudge?: boolean;
};

/**
 * Draggable before/after comparison. Pointer, touch and keyboard all work, and the
 * reveal animation only runs once, when the panel is in view and untouched.
 */
export function BeforeAfter({ before, after, beforeAlt, afterAlt, nudge = true }: Props) {
  const [position, setPosition] = useState(50);
  const [interacted, setInteracted] = useState(false);
  const [seen, setSeen] = useState(false);
  const frame = useRef<HTMLDivElement | null>(null);
  const handle = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const setFromClientX = (clientX: number) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)));
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      event.preventDefault();
      setFromClientX(event.clientX);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      frame.current?.classList.remove("is-dragging");
      handle.current?.focus({ preventScroll: true });
    };
    addEventListener("pointermove", move, { passive: false });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
  }, []);

  const auto = nudge && seen && !interacted;

  return (
    <div
      className={`ba${auto ? " is-auto" : ""}`}
      ref={frame}
      onPointerDown={(event) => {
        setInteracted(true);
        dragging.current = true;
        frame.current?.classList.add("is-dragging");
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        setFromClientX(event.clientX);
      }}
    >
      <Image className="ba-img" src={after} alt={afterAlt} fill sizes="(max-width: 900px) 100vw, 900px" draggable={false} />
      <div className="ba-clip" style={{ width: `${position}%` }}>
        <Image className="ba-img ba-img-before" src={before} alt={beforeAlt} fill sizes="(max-width: 900px) 100vw, 900px" draggable={false} />
        <span className="ba-tag is-before">Before · choked coil</span>
      </div>
      <span className="ba-tag is-after">After · jet cleaned</span>
      <div
        className="ba-divider"
        style={{ left: `${position}%` }}
        aria-hidden="true"
      >
        <div
          ref={handle}
          className="ba-handle"
          role="slider"
          tabIndex={0}
          aria-label="Compare before and after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${Math.round(position)}% before`}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 10 : 3;
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              setInteracted(true);
              setPosition((p) => Math.max(4, p - step));
            }
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              setInteracted(true);
              setPosition((p) => Math.min(96, p + step));
            }
            if (event.key === "Home") { setInteracted(true); setPosition(4); }
            if (event.key === "End") { setInteracted(true); setPosition(96); }
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6 4 12l5 6M15 6l5 6-5 6" />
          </svg>
        </div>
      </div>
      <p className="ba-hint">Drag to compare<span aria-hidden="true"> · or use ← →</span></p>
    </div>
  );
}
