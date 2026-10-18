"use client";

import { useEffect } from "react";
import { useFinePointer } from "@/lib/use-motion";

/**
 * A soft cold haze that lags a few frames behind the cursor. It is a single fixed
 * element driven by one transform, only mounted for fine pointers, and it never
 * receives events, so it cannot change what a click lands on.
 */
export function ColdMist() {
  const fine = useFinePointer();

  useEffect(() => {
    if (!fine) return;
    const el = document.getElementById("cold-mist");
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let frame = 0;
    let idle = 0;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      el.classList.add("is-on");
      if (idle) {
        clearTimeout(idle);
        idle = 0;
      }
      // Retire the glow when the pointer stops moving; a static gradient is just noise.
      idle = window.setTimeout(() => el.classList.remove("is-on"), 2400);
      if (!frame) loop();
    };

    const loop = () => {
      frame = 0;
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (Math.abs(targetX - x) > 0.4 || Math.abs(targetY - y) > 0.4) frame = requestAnimationFrame(loop);
    };

    addEventListener("pointermove", onMove, { passive: true });
    return () => {
      removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
      if (idle) clearTimeout(idle);
    };
  }, [fine]);

  if (!fine) return null;
  return <div id="cold-mist" className="cold-mist" aria-hidden="true" />;
}
