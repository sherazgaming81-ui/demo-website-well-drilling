"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { bookingServices, business } from "@/lib/site-data";

/**
 * The assistant, in two shells: the floating box on the home page and the full page
 * at /assistant (the floating box is cramped for long answers on a desktop, and the
 * page is roomy on any screen).
 *
 * Sentinels the model may emit are stripped before display:
 *   [[BOOK]]               → highlights the estimate button
 *   [[SERVICE:rock-wells]] → pre-selects that service when the visitor books
 */

type ChatTurn = { role: "user" | "assistant"; content: string; error?: boolean };

type FlowProgress = { stage: string; label: string } | null;

const GREETING = `Hi — I'm the assistant here. Ask me anything about wells, pumps or water for your property. I can also take your estimate request right here in the chat, or you can use the estimate form. How can I help?`;

const SENTINEL = /\[\[(BOOK|SERVICE:([a-z0-9-]+))\]\]/gi;
const STAGES = ["service", "zip", "date", "time", "name", "email", "phone", "notes", "consent", "confirm"] as const;

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

export function ChatWidget({ onBook, variant = "floating" }: { onBook: (serviceId?: string) => void; variant?: "floating" | "page" }) {
  const [open, setOpen] = useState(variant === "page");
  const [turns, setTurns] = useState<ChatTurn[]>([{ role: "assistant", content: GREETING }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [nudgeBook, setNudgeBook] = useState(false);
  const [serviceHint, setServiceHint] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [progress, setProgress] = useState<FlowProgress>(null);
  const [reference, setReference] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  // One identity per page view, so the guided booking can be resumed mid-flow and a
  // repeated "yes" cannot double-book. Never rendered, so SSR/client differ harmlessly.
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const scrollToEnd = useCallback(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(scrollToEnd, [turns, busy, chips, scrollToEnd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 220);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
    };
     
  }, [open]);

  function closePanel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    launcherRef.current?.focus();
  }

  function resetFlowUI() {
    setChips([]);
    setProgress(null);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    const history: ChatTurn[] = [...turns, { role: "user", content: message }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    setNudgeBook(false);

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
              chips?: string[];
              progress?: FlowProgress;
              booked?: { reference: string };
            };

            if (payload.type === "delta" && payload.text) {
              updateLast((turn) => ({ ...turn, content: turn.content + payload.text }));
            } else if (payload.type === "error" && payload.message) {
              updateLast((turn) => ({ ...turn, error: true }));
            } else if (payload.type === "booking") {
              setChips(Array.isArray(payload.chips) ? payload.chips : []);
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
        }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  // The flow may point at a specific service; remember it for the estimate form.
  const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant" && turn.content);
  const suggestedService = lastAssistant ? parseSentinels(lastAssistant.content).service : null;

  useEffect(() => {
    if (suggestedService) setServiceHint(suggestedService);
  }, [suggestedService]);

  const stageIndex = progress ? STAGES.indexOf(progress.stage as (typeof STAGES)[number]) : -1;

  const panel = (
    <section
      id={variant === "page" ? "site-assistant-page" : "site-assistant"}
      className={`chat-panel is-open${variant === "page" ? " is-page" : ""}`}
      role="dialog"
      aria-label={`${business.name} assistant`}
      data-provider={provider ?? "offline"}
      data-stage={progress?.stage ?? "chat"}
    >
      <header className="chat-head">
        <span className="chat-head-mark" aria-hidden="true">
          <Icon name="droplet" size={17} />
        </span>
        <div className="chat-head-text">
          <strong>Aquifer Reach Assistant</strong>
          <span>{busy ? "Typing…" : progress ? progress.label : "Ask away — or say 'book' and I'll take your request"}</span>
        </div>
        {variant === "floating" && (
          <Link className="chat-head-expand" href="/assistant" aria-label="Open the assistant on its own page">
            <Icon name="arrow-up-right" size={15} />
          </Link>
        )}
        {variant === "floating" && (
          <button type="button" className="chat-head-close icon-button" onClick={closePanel} aria-label="Close chat">
            <Icon name="close" size={18} />
          </button>
        )}
      </header>

      {progress && stageIndex >= 0 && (
        <div className="chat-meter" role="progressbar" aria-valuemin={1} aria-valuemax={STAGES.length} aria-valuenow={stageIndex + 1} aria-label="Booking progress">
          {STAGES.map((stage) => (
            <i key={stage} className={stageIndex >= STAGES.indexOf(stage) ? "is-done" : ""} />
          ))}
        </div>
      )}

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
                text && <p className="chat-bubble">{text}</p>
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

      {turns.length <= 1 && !chips.length && (
        <div className="chat-chips">
          {["What does a well cost?", "Do you cover my area?", "How long does drilling take?", "I'd like to book an estimate"].map((chip) => (
            <button key={chip} type="button" onClick={() => send(chip)} disabled={busy}>
              {chip}
            </button>
          ))}
        </div>
      )}

      {!!chips.length && (
        <div className="chat-chips is-flow" aria-label="Suggested answers">
          {chips.map((chip) => (
            <button key={chip} type="button" onClick={() => send(chip)} disabled={busy}>
              {chip}
            </button>
          ))}
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
            // Only a service the estimate form actually offers is pre-selected.
            const known = bookingServices.some((service) => service.value === serviceHint);
            onBook(known && serviceHint ? serviceHint : "");
            setServiceHint(null);
            setNudgeBook(false);
            resetFlowUI();
            if (variant === "floating") setOpen(false);
          }}
        >
          {reference ? "Book another" : "Use the estimate form"}
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
        <label className="sr-only" htmlFor={variant === "page" ? "chat-message-page" : "chat-message"}>
          Your question
        </label>
        <input
          id={variant === "page" ? "chat-message-page" : "chat-message"}
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={progress ? "Type your answer, or 'cancel' to stop" : "Ask about your property, or say 'book'…"}
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
        Automated assistant. Requests you send here go to the same place as the estimate form. For anything urgent, call{" "}
        <a href={business.phoneHref}>{business.phoneDisplay}</a>.
      </p>
    </section>
  );

  if (variant === "page") {
    return <div className="chat-page">{panel}</div>;
  }

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
        aria-label={open ? "Close the assistant" : "Ask about your well"}
        onClick={() => (open ? closePanel() : setOpen(true))}
      >
        <span className="chat-launcher-icon">
          <Icon name={open ? "close" : "message"} size={19} />
        </span>
        <span className="chat-launcher-label">{open ? "Close" : "Ask about your well"}</span>
      </button>
      {open && panel}
    </>
  );
}
