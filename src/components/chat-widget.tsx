"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { bookingServices, business } from "@/lib/site-data";
import { useNotify, useTabBadge } from "@/lib/use-notify";

/**
 * The site assistant: one floating box, on the home page only.
 *
 * Shaped after the support chat people already recognise — a round launcher, a
 * greeting screen with the last message you can go back to, an option menu with
 * Expand / Download transcript / Start new chat, and a composer with an emoji
 * button and nothing else. Files and voice input were left out on purpose: this
 * chat takes text and books a visit; a "paperclip" that cannot accept a file
 * would be a dead end, and dead ends are the one thing this widget is not allowed
 * to have.
 *
 * Sentinels the model may emit are stripped before display:
 *   [[BOOK]]               → highlights the inspection button
 *   [[SERVICE:ac-gas]]     → pre-selects that service when the visitor books
 */

type ChatTurn = { role: "user" | "assistant"; content: string; at: number; error?: boolean };

type FlowProgress = { stage: string; label: string } | null;

type Saved = { sessionId: string; turns: ChatTurn[] };

const STORE_KEY = "freezepoint.chat.v1";
/** The picker's "frequently used" row is measured in this tab, never assumed. */
const EMOJI_STORE_KEY = "freezepoint.emoji.v1";
/** Kept short on both ends: the last few turns are enough to pick a chat back up,
 *  and this is a tab-local note, not an archive. */
const KEEP_TURNS = 14;

/**
 * The picker's alphabet, spelled in code points on purpose: emoji pasted into a source
 * file can survive as blank boxes, and a blank button in a picker is exactly the dead
 * control this widget is not allowed to ship. The check under this table refuses an
 * empty or duplicated entry at build time instead of in front of a visitor.
 */
const cp = (...points: number[]) => String.fromCodePoint(...points);
type EmojiGroup = { group: string; items: [string, string][] };
const EMOJI_GROUPS: EmojiGroup[] = [
  {
    group: "Quick replies",
    items: [
      ["thumbs up", cp(0x1f44d)], ["thumbs down", cp(0x1f44e)], ["please", cp(0x1f64f)], ["slight smile", cp(0x1f642)],
      ["laughing", cp(0x1f605)], ["yes", cp(0x2705)], ["no", cp(0x274c)], ["snowflake", cp(0x2744, 0xfe0f)],
      ["wrench", cp(0x1f527)], ["phone", cp(0x1f4de)],
    ],
  },
  {
    group: "Faces",
    items: [
      ["grinning", cp(0x1f600)], ["big eyes", cp(0x1f603)], ["beaming", cp(0x1f601)], ["squint", cp(0x1f606)],
      ["tears of joy", cp(0x1f602)], ["rofl", cp(0x1f923)], ["smirk", cp(0x1f60f)], ["wink", cp(0x1f609)],
      ["heart eyes", cp(0x1f60d)], ["relieved", cp(0x1f62c)], ["sunglasses", cp(0x1f60e)], ["thinking", cp(0x1f914)],
      ["neutral", cp(0x1f610)], ["expressionless", cp(0x1f611)], ["unamused", cp(0x1f612)], ["rolling eyes", cp(0x1f644)],
      ["worried", cp(0x1f61f)], ["frowning", cp(0x1f61e)], ["anguished", cp(0x1f627)], ["crying", cp(0x1f622)],
      ["sobbing", cp(0x1f62d)], ["weary", cp(0x1f629)], ["angry", cp(0x1f620)], ["hot", cp(0x1f975)],
      ["cold", cp(0x1f976)], ["sleepy", cp(0x1f634)], ["sick", cp(0x1f912)], ["party", cp(0x1f973)],
    ],
  },
  {
    group: "Hands",
    items: [
      ["wave", cp(0x1f44b)], ["clap", cp(0x1f44f)], ["raised hands", cp(0x1f64c)], ["handshake", cp(0x1f91d)],
      ["ok hand", cp(0x1f44c)], ["victory", cp(0x270c, 0xfe0f)], ["point right", cp(0x1f449)], ["point left", cp(0x1f448)],
      ["strong", cp(0x1f4aa)], ["folded hands", cp(0x1f64f)],
    ],
  },
  {
    group: "Cooling, home and tools",
    items: [
      ["house", cp(0x1f3e0)], ["snowman", cp(0x2603, 0xfe0f)], ["ice", cp(0x1f9ca)], ["dashing away", cp(0x1f4a8)],
      ["hammer and wrench", cp(0x1f6e0, 0xfe0f)], ["gear", cp(0x2699, 0xfe0f)], ["electric plug", cp(0x1f50c)],
      ["light bulb", cp(0x1f4a1)], ["thermometer", cp(0x1f321)], ["sun", cp(0x2600, 0xfe0f)], ["moon", cp(0x1f319)],
      ["high voltage", cp(0x26a1)], ["broom", cp(0x1f9f9)], ["bucket", cp(0x1faa3)], ["droplet", cp(0x1f4a7)],
      ["wind face", cp(0x1f32c)],
    ],
  },
  {
    group: "Marks, dates and the office",
    items: [
      ["check mark", cp(0x2714, 0xfe0f)], ["checked box", cp(0x2611, 0xfe0f)], ["cross mark", cp(0x274c)],
      ["warning", cp(0x26a0, 0xfe0f)], ["question", cp(0x2753)], ["exclamation", cp(0x2757)], ["bell", cp(0x1f514)],
      ["calendar", cp(0x1f4c5)], ["memo", cp(0x1f4dd)], ["speech bubble", cp(0x1f4ac)], ["star", cp(0x2b50)],
      ["hourglass", cp(0x231b)], ["truck", cp(0x1f69a)], ["money bag", cp(0x1f4b0)], ["outbox", cp(0x1f4e4)],
      ["mobile phone", cp(0x1f4f1)],
    ],
  },
];
const EMOJIS = EMOJI_GROUPS.flatMap((set) => set.items.map(([name, ch]) => ({ name, ch, group: set.group })));
{
  const blank = EMOJIS.filter((emoji) => emoji.ch.trim().length === 0).length;
  const names = new Set(EMOJIS.map((emoji) => `${emoji.group}/${emoji.name}`));
  if (blank) throw new Error(`emoji picker: ${blank} entr${blank === 1 ? "y" : "ies"} produced no glyph`);
  if (names.size !== EMOJIS.length) throw new Error("emoji picker: two entries share one name");
  if (EMOJIS.length < 40) throw new Error(`emoji picker: only ${EMOJIS.length} entries`);
}

const SENTINEL = /\[\[(BOOK|SERVICE:([a-z0-9-]+))\]\]/gi;

function parseSentinels(raw: string): { text: string; book: boolean; service: string | null } {
  let book = false;
  let service: string | null = null;

  const text = raw
    .replace(SENTINEL, (_match, token: string, id?: string) => {
      if (token === "BOOK") book = true;
      else if (id) service = id;
      return "";
    })
    // Hide a half-written sentinel while the answer is still streaming.
    .replace(/\[\[[A-Za-z:0-9-]*$/, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  return { text, book, service };
}

function newSessionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The chat lives in this tab only (sessionStorage): reload and it is still there,
 *  close the tab and it is gone. Nothing here is sent anywhere until a request is
 *  submitted, which is what the privacy dialog says. */
function readSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    if (!parsed || typeof parsed.sessionId !== "string" || !Array.isArray(parsed.turns)) return null;
    const turns = parsed.turns
      .filter((turn): turn is ChatTurn => !!turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
      .map((turn) => ({ ...turn, at: Number(turn.at) || Date.now() }));
    return turns.length >= 2 ? { sessionId: parsed.sessionId, turns: turns.slice(-KEEP_TURNS) } : null;
  } catch {
    return null;
  }
}

function timeAgo(at: number): string {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function transcriptText(turns: ChatTurn[], reference: string | null) {
  const head = [
    `${business.name} — chat transcript`,
    `Saved ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
    reference ? `Inspection request reference: ${reference}` : "No request was submitted from this chat.",
    `This is an automated assistant. To speak to the office: ${business.phoneDisplay}.`,
    "",
  ].join("\n");
  const body = turns
    .filter((turn) => parseSentinels(turn.content).text)
    .map((turn) => `${turn.role === "user" ? "You" : business.shortName} · ${new Date(turn.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}\n${parseSentinels(turn.content).text}\n`)
    .join("\n");
  return `${head}\n${body}`;
}

export function ChatWidget({ onBook }: { onBook: (serviceId?: string) => void }) {
  const [saved] = useState<Saved | null>(() => (typeof window === "undefined" ? null : readSaved()));
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [nudgeBook, setNudgeBook] = useState(false);
  const [serviceHint, setServiceHint] = useState<string | null>(null);
  const [progress, setProgress] = useState<FlowProgress>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [menu, setMenu] = useState<"none" | "options" | "emoji">("none");
  const [emojiQuery, setEmojiQuery] = useState("");
  const [recentEmoji, setRecentEmoji] = useState<string[]>(() => {
    try {
      const raw = typeof window === "undefined" ? null : sessionStorage.getItem(EMOJI_STORE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const emojiSearchRef = useRef<HTMLInputElement>(null);

  const { unread, notify, look, soundOn, toggleSound } = useNotify();
  useTabBadge(unread);
  const pendingNotify = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLButtonElement>(null);
  const emojiRef = useRef<HTMLButtonElement>(null);
  // One identity per browser tab, so a reload can resume a half-finished booking and
  // a repeated "yes" cannot double-book. Never rendered, so SSR/client differ harmlessly.
  const [sessionId, setSessionId] = useState(() => saved?.sessionId ?? newSessionId());

  const scrollToEnd = useCallback(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(scrollToEnd, [turns, busy, open, scrollToEnd]);

  /* An answer that lands while the panel is shut (or the tab is in the background)
     is what deserves a chime and a count — one you are already reading gets neither. */
  useEffect(() => {
    if (busy || !pendingNotify.current) return;
    pendingNotify.current = false;
    if (!open || document.hidden) notify();
  }, [busy, open, notify]);

  // Keep the tab copy short and current. Written on every change so a reload in the
  // middle of the guided flow lands back on the same step.
  useEffect(() => {
    if (!turns.length) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ sessionId, turns: turns.slice(-KEEP_TURNS) }));
    } catch {
      /* private mode, or a full quota: the chat simply will not survive a reload */
    }
  }, [turns, sessionId]);

  useEffect(() => {
    if (!open) return;
    // Escape closes a menu first and the panel second; a click inside the panel that
    // is not on an opener or inside the open popover closes the popover. The two
    // menus live in different corners, so containment is tested with closest().
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menu !== "none") setMenu("none");
      else closePanel();
    };
    const onClick = (event: MouseEvent) => {
      if (menu === "none") return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest(".chat-menu, .chat-emoji, .chat-head-btn, .chat-tool")) return;
      setMenu("none");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    const focusTimer = setTimeout(() => (menu === "emoji" ? emojiSearchRef.current : inputRef.current)?.focus(), 220);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
      clearTimeout(focusTimer);
    };
  }, [open, menu]);

  function closePanel() {
    // Deliberately not aborting: an answer already on its way should finish, land in
    // the transcript and chime — closing the window is not the same as "stop talking".
    // The Stop button and Start a new chat are what cancel a stream.
    setMenu("none");
    setOpen(false);
    launcherRef.current?.focus();
  }

  function openPanel() {
    look();
    // Deliberately not auto-resuming: a tab that comes back to a conversation sees the
    // greeting with the last message on it, and chooses. Restoring silently would put
    // words on screen the visitor never asked to see again.
    setOpen(true);
  }

  function startNewChat() {
    abortRef.current?.abort();
    setMenu("none");
    setTurns([]);
    setDraft("");
    setProgress(null);
    setReference(null);
    setNudgeBook(false);
    setServiceHint(null);
    // A new conversation gets a new identity, so the flow on the server starts clean.
    const fresh = newSessionId();
    setSessionId(fresh);
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ sessionId: fresh, turns: [] }));
    } catch {
      /* see above */
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function downloadTranscript() {
    setMenu("none");
    const url = URL.createObjectURL(new Blob([transcriptText(turns, reference)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${business.shortName}-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function addEmoji(emoji: string) {
    setDraft((current) => `${current}${current && !/\s$/.test(current) ? " " : ""}${emoji}`);
    setMenu("none");
    setEmojiQuery("");
    setRecentEmoji((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, 8);
      try {
        sessionStorage.setItem(EMOJI_STORE_KEY, JSON.stringify(next));
      } catch {
        /* no tab storage, no memory of it — the picker still works */
      }
      return next;
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /* The picker: a search field first (that is how people actually use one), then the
     groups. "Frequently used" only appears once the visitor has used it in this tab. */
  const query = emojiQuery.trim().toLowerCase();
  const recentItems = recentEmoji.map((ch) => ({ name: "used recently", ch }));
  const searched = EMOJIS.filter((emoji) => emoji.name.toLowerCase().includes(query) || emoji.ch === emojiQuery.trim());
  const pickedGroups: { group: string; items: { name: string; ch: string }[] }[] = query
    ? [{ group: "Results", items: searched }]
    : [
        ...(recentItems.length ? [{ group: "Frequently used", items: recentItems }] : []),
        ...EMOJI_GROUPS.map((set) => ({ group: set.group, items: set.items.map(([name, ch]) => ({ name, ch })) })),
      ];
  const pickedCount = pickedGroups.reduce((total, set) => total + set.items.length, 0);

  function resetFlowUI() {
    setProgress(null);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    const now = Date.now();
    const history: ChatTurn[] = [...turns, { role: "user", content: message, at: now }];
    setTurns([...history, { role: "assistant", content: "", at: now }]);
    setDraft("");
    setBusy(true);
    setNudgeBook(false);
    setMenu("none");
    pendingNotify.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    const updateLast = (updater: (previous: ChatTurn) => ChatTurn) =>
      setTurns((current) => {
        const next = [...current];
        next[next.length - 1] = updater(next[next.length - 1]);
        return next;
      });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          sessionId,
          messages: history
            .filter((turn) => turn.content.trim())
            .map((turn) => ({ role: turn.role, content: turn.content })),
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(
          (detail as { error?: string } | null)?.error ??
            `The assistant is unavailable right now. Please call ${business.phoneDisplay}.`,
        );
      }

      setProvider(response.headers.get("X-AI-Provider"));

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream.");

      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const line = chunk.split("\n").find((part) => part.startsWith("data:"));
          if (!line) continue;

          try {
            const payload = JSON.parse(line.slice(5).trim()) as {
              type: string;
              text?: string;
              message?: string;
              progress?: FlowProgress;
              booked?: { reference: string };
            };

            const piece = payload.text;
            if (payload.type === "delta" && piece) {
              updateLast((turn) => ({ ...turn, content: turn.content + piece }));
            } else if (payload.type === "replace" && piece) {
              // Authoritative final text from the server: price-free, no reasoning.
              updateLast(() => ({ role: "assistant", content: piece, at: Date.now() }));
            } else if (payload.type === "error" && payload.message) {
              updateLast((turn) => ({ ...turn, error: true }));
            } else if (payload.type === "booking") {
              // Only the stage label is surfaced (in the header). The flow asks in
              // words and answers in words; no button row is injected mid-booking.
              setProgress(payload.progress ?? null);
              if (payload.booked?.reference) {
                setReference(payload.booked.reference);
                resetFlowUI();
              }
            } else if (payload.type === "done") {
              setNudgeBook(true);
            }
          } catch {
            // Ignore malformed frames; the next one will carry the text.
          }
        }
      }

      updateLast((turn) => {
        if (turn.content.trim()) return turn;
        return {
          ...turn,
          content: `Sorry — I lost that reply. Please try again, or call ${business.phoneDisplay}.`,
          error: true,
        };
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setTurns((current) => current.filter((turn, index) => index !== current.length - 1 || turn.content));
      } else {
        updateLast(() => ({
          role: "assistant",
          content:
            error instanceof Error && error.message
              ? error.message
              : `Something went wrong on our side. Please call ${business.phoneDisplay}.`,
          error: true,
          at: Date.now(),
        }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  // The flow may point at a specific service; remember it for the booking form.
  const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant" && turn.content);
  const suggestedService = lastAssistant ? parseSentinels(lastAssistant.content).service : null;

  useEffect(() => {
    if (suggestedService) setServiceHint(suggestedService);
  }, [suggestedService]);

  const greeting = !turns.length;
  const recent = saved?.turns.filter((turn) => turn.role === "assistant").pop();
  const recentLine = recent ? parseSentinels(recent.content).text.split("\n")[0] : "";

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={`chat-launcher${open ? " is-open" : ""}${nudgeBook ? " is-nudging" : ""}`}
        aria-expanded={open}
        aria-controls="site-assistant"
        // Below 580px the visible label is display:none, so the button would have
        // no accessible name at all on phones — the label has to exist for assistive tech too.
        data-unread={unread > 0 ? String(unread) : undefined}
        aria-label={
          open
            ? "Close the assistant"
            : unread > 0
              ? `Ask about your AC — ${unread} new ${unread === 1 ? "reply" : "replies"}`
              : "Ask about your AC"
        }
        onClick={() => (open ? closePanel() : openPanel())}
      >
        <span className="chat-launcher-icon" aria-hidden="true">
          <Icon name={open ? "close" : "snowflake"} size={22} />
        </span>
        <span className="chat-launcher-label">{open ? "Close" : "Ask about your AC"}</span>
      </button>

      {open && (
        <section
          id="site-assistant"
          className={`chat-panel${expanded ? " is-expanded" : ""}`}
          role="dialog"
          aria-label={`${business.name} assistant`}
          data-provider={provider ?? "unreachable"}
          data-stage={progress?.stage ?? "chat"}
        >
          <header className="chat-head">
            <span className="chat-head-mark" aria-hidden="true">
              <Icon name="snowflake" size={17} />
            </span>
            <div className="chat-head-text">
              <strong>{business.shortName} Assistant</strong>
              <span>{busy ? "Typing…" : progress ? progress.label : "The workshop can also help — just ask"}</span>
            </div>
            <div className="chat-head-tools">
              <div className="chat-head-slot">
                <button
                  ref={optionsRef}
                  type="button"
                  className={`chat-head-btn${menu === "options" ? " is-active" : ""}`}
                  onClick={() => setMenu(menu === "options" ? "none" : "options")}
                  aria-label="Chat options"
                  aria-expanded={menu === "options"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" />
                  </svg>
                </button>
                {menu === "options" && (
                  <div className="chat-menu" role="menu" aria-label="Chat options">
                    <button type="button" role="menuitem" onClick={() => { setExpanded((v) => !v); setMenu("none"); }}>
                      <Icon name={expanded ? "minus" : "plus"} size={14} />
                      {expanded ? "Shrink window" : "Expand window"}
                    </button>
                    <button type="button" role="menuitem" onClick={downloadTranscript} disabled={turns.length === 0}>
                      <Icon name="download" size={14} />
                      Download transcript
                    </button>
                    <button type="button" role="menuitem" onClick={() => { toggleSound(); setMenu("none"); }}>
                      <Icon name={soundOn ? "bell" : "bell-off"} size={14} />
                      {soundOn ? "Turn reply chime off" : "Turn reply chime on"}
                    </button>
                    <button type="button" role="menuitem" onClick={startNewChat} disabled={turns.length === 0}>
                      <Icon name="close" size={14} />
                      Start a new chat
                    </button>
                  </div>
                )}
              </div>
              <button type="button" className="chat-head-btn" onClick={closePanel} aria-label="Close chat">
                <Icon name="close" size={18} />
              </button>
            </div>
          </header>

          {greeting ? (
            <div className="chat-greet">
              <div className="chat-greet-in">
              <p className="chat-greet-hi">Hi there <span aria-hidden="true">👋</span></p>
              <h2>How can we help?</h2>
              <p className="chat-greet-sub">
                AC ka fault, gas, service ya naya unit — jo poochna hai poochhein. Booking ke liye bas <em>book</em> likh dein.
              </p>
              {recentLine && (
                <button type="button" className="chat-recent" onClick={() => { setTurns(saved?.turns ?? []); setMenu("none"); }}>
                  <span className="chat-recent-top">
                    <strong>Recent message</strong>
                    <span>{timeAgo(recent?.at ?? Date.now())}</span>
                  </span>
                  <span className="chat-recent-line">{recentLine}</span>
                  <span className="chat-recent-go">Pick the chat back up<Icon name="arrow-right" size={13} /></span>
                </button>
              )}
              </div>
            </div>
          ) : (
            <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions text">
              {turns.map((turn, index) => {
                const isLast = index === turns.length - 1;
                const { text } = parseSentinels(turn.content);
                const pending = busy && isLast && turn.role === "assistant" && !text;

                return (
                  <div key={index} className={`chat-row chat-row-${turn.role}${turn.error ? " is-error" : ""}`}>
                    {pending ? (
                      <p className="chat-bubble chat-typing" aria-label="Assistant is typing">
                        <i />
                        <i />
                        <i />
                      </p>
                    ) : (
                      text && (
                        <div className="chat-say">
                          <p className="chat-bubble">{text}</p>
                          {turn.role === "assistant" && (
                            <p className="chat-meta">
                              {business.shortName} · AI assistant · {timeAgo(turn.at)}
                            </p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              })}

              {reference && (
                <div className="chat-booked-card">
                  <span className="chat-booked-eyebrow">REQUEST SENT</span>
                  <strong className="chat-booked-ref">{reference}</strong>
                  <p>Keep that reference handy. Someone from the office will call you to agree the time — a chat request is not a confirmed booking.</p>
                  <a className="chat-booked-call" href={business.phoneHref}>
                    <Icon name="phone" size={15} />
                    {business.phoneDisplay}
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="chat-actions">
            <button
              type="button"
              className={`button button-primary chat-book${nudgeBook ? " is-highlighted" : ""}`}
              onClick={() => {
                if (reference) {
                  setDraft("");
                  send("start over");
                  return;
                }
                // Only a service the booking form actually offers is pre-selected.
                const known = bookingServices.some((service) => service.value === serviceHint);
                onBook(known && serviceHint ? serviceHint : "");
                setServiceHint(null);
                setNudgeBook(false);
                resetFlowUI();
                setOpen(false);
              }}
            >
              {reference ? "Book another" : "Use the inspection form"}
              <Icon name="arrow-up-right" size={16} />
            </button>
            <a className="chat-call" href={business.phoneHref}>
              <Icon name="phone" size={15} />
              {business.phoneDisplay}
            </a>
          </div>

          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <div className="chat-input-slot">
              <button
                ref={emojiRef}
                type="button"
                className={`chat-tool${menu === "emoji" ? " is-active" : ""}`}
                onClick={() => setMenu(menu === "emoji" ? "none" : "emoji")}
                aria-label="Add an emoji"
                aria-expanded={menu === "emoji"}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.4 4.4 0 0 0 7 0" strokeLinecap="round" />
                  <circle cx="9" cy="9.8" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="9.8" r="1" fill="currentColor" stroke="none" />
                </svg>
              </button>
              {menu === "emoji" && (
                <div className="chat-emoji" role="dialog" aria-modal="false" aria-label="Emoji picker">
                  <label className="sr-only" htmlFor="chat-emoji-search">Search emoji by name</label>
                  <input
                    id="chat-emoji-search"
                    ref={emojiSearchRef}
                    className="chat-emoji-search"
                    value={emojiQuery}
                    onChange={(event) => setEmojiQuery(event.target.value.slice(0, 24))}
                    placeholder="Search emoji…"
                    autoComplete="off"
                  />
                  <div className="chat-emoji-scroll">
                    {pickedGroups.map((set) => (
                      <div key={set.group}>
                        <p className="chat-emoji-group">{set.group}</p>
                        <div className="chat-emoji-grid">
                          {set.items.map((item) => (
                            <button key={`${set.group}-${item.name}`} type="button" onClick={() => addEmoji(item.ch)} title={item.name} aria-label={`${item.name} emoji`}>
                              {item.ch}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!pickedCount && <p className="chat-emoji-empty">Nothing matches “{emojiQuery.trim()}”.</p>}
                  </div>
                </div>
              )}
            </div>
            <label className="sr-only" htmlFor="chat-message">Your question</label>
            <input
              id="chat-message"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={progress ? "Type your answer, or 'cancel' to stop" : greeting ? "Send us a message — or say 'book'…" : "Ask about your AC…"}
              maxLength={1500}
              autoComplete="off"
            />
            {busy ? (
              <button type="button" className="chat-send is-stop" onClick={() => abortRef.current?.abort()} aria-label="Stop the answer">
                <Icon name="close" size={16} />
              </button>
            ) : (
              <button type="submit" className="chat-send" disabled={!draft.trim()} aria-label="Send your question">
                <Icon name="arrow-right" size={17} />
              </button>
            )}
          </form>

          <p className="chat-disclosure">
            Automated assistant. Requests you send here go to the same place as the inspection form. For anything urgent, call{" "}
            <a href={business.phoneHref}>{business.phoneDisplay}</a>.
          </p>
        </section>
      )}
    </>
  );
}
