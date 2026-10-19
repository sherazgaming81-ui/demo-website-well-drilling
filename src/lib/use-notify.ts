"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The two things that make a background assistant behave like a messaging app:
 * a short chime when an answer lands while you are not looking, and a count on the
 * browser tab. Both are cleared the moment you look.
 *
 * No audio file is shipped — the chime is two sine notes built with WebAudio, so it
 * costs nothing over the wire and cannot fail to load. The on/off choice is one
 * boolean in localStorage, and nothing else is remembered.
 */

const SOUND_KEY = "freezepoint.notify-sound.v1";
const BADGE_LIMIT = 9;

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function playChime(context: AudioContext) {
  const start = context.currentTime;
  const notes: Array<[number, number]> = [
    [880, 0],
    [1245, 0.13],
  ];
  for (const [frequency, offset] of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    // a soft attack and a real tail, so it reads as a chime and not a beep
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.22);
  }
}

/** Draws the count over the app's own icon, so the tab badge matches the favicon. */
async function badgedIcon(count: number): Promise<string | null> {
  try {
    const image = new window.Image();
    image.src = "/icons/icon-192.png";
    await (typeof image.decode === "function" ? image.decode() : new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("icon did not load"));
    }));
    const size = image.naturalWidth || 192;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, size, size);
    const radius = Math.round(size * 0.215);
    const centreX = size - radius - Math.round(size * 0.04);
    const centreY = radius + Math.round(size * 0.04);
    ctx.beginPath();
    ctx.arc(centreX, centreY, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#d97a2b";
    ctx.fill();
    ctx.lineWidth = Math.max(3, Math.round(size * 0.035));
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(size * (count > 9 ? 0.26 : 0.34))}px "Freeze Body", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count > BADGE_LIMIT ? `${BADGE_LIMIT}+` : String(count), centreX, centreY + Math.round(size * 0.012));
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function setFavicon(href: string | null) {
  // every icon link, not the first: Next emits both /favicon.ico and /icon.png, and
  // which one a browser paints is the browser's mood — a badge only half-applied is a
  // badge that silently does nothing on some machines
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="shortcut icon"]'));
  if (!links.length) {
    const link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
    links.push(link);
  }
  for (const link of links) {
    if (href === null) {
      if (link.dataset.originalHref) {
        link.href = link.dataset.originalHref;
        delete link.dataset.originalHref;
      }
      continue;
    }
    if (!link.dataset.originalHref) link.dataset.originalHref = link.href;
    link.href = href;
  }
}

export function useTabBadge(unread: number) {
  const baseTitle = useRef<string | null>(null);

  useEffect(() => {
    if (baseTitle.current === null) baseTitle.current = document.title;
    const title = baseTitle.current;
    document.title = unread > 0 ? `(${unread > BADGE_LIMIT ? `${BADGE_LIMIT}+` : unread}) ${title}` : title;

    let cancelled = false;
    if (unread > 0) {
      void badgedIcon(unread).then((href) => {
        if (!cancelled && href) setFavicon(href);
      });
    } else {
      setFavicon(null);
    }
    return () => {
      cancelled = true;
    };
  }, [unread]);

  // leaving the page must not strand a badge or a rewritten title
  useEffect(
    () => () => {
      if (baseTitle.current !== null) document.title = baseTitle.current;
      setFavicon(null);
    },
    [],
  );
}

export function useNotify() {
  // read lazily: the same value is correct on the first render, so no effect is needed
  const [soundOn, setSoundOn] = useState(readSoundPref);
  const [unread, setUnread] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);

  const look = useCallback(() => setUnread(0), []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") look();
    };
    const onFocus = () => look();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [look]);

  /** Called when a finished answer should reach the visitor without their eyes on it. */
  const notify = useCallback(() => {
    setUnread((count) => count + 1);
    // one chime per finished answer, written to the document so the launcher can show
    // it and so the behaviour is observable rather than assumed
    const pings = Number(document.documentElement.dataset.chatPing ?? 0) + 1;
    document.documentElement.dataset.chatPing = String(pings);
    if (!readSoundPref()) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioRef.current ??= new Ctor();
      const context = audioRef.current;
      if (context.state === "suspended") void context.resume();
      playChime(context);
    } catch {
      /* no audio device, or the browser refused before a gesture: the badge still works */
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((current) => {
      const next = !current;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        /* private mode: the choice simply does not persist */
      }
      return next;
    });
  }, []);

  return { unread, notify, look, soundOn, toggleSound };
}
