/**
 * Last line of defence between a language model and a customer.
 *
 * The brief forbids quoting prices and narrating reasoning, and the gateway is asked
 * not to send reasoning at all. That is not enough on its own: live, the model invented
 * "**$3,750 to $15,500**" for a well. A wrong number on a real business's site is a
 * promise the owner has to keep, so every answer passes through here first.
 */

const PRICE =
  /(?:\bus\b\s*)?\$\s?\d[\d,]*(?:\.\d{1,2})?(?:\s*(?:to|through|-|\u2013|\u2014)\s*\$?\s?\d[\d,]*(?:\.\d{1,2})?)?|\b(?:Rs|PKR|INR)\.?\s?\d[\d,]*(?:\.\d{1,2})?(?:\s*(?:to|-|\u2013|\u2014)\s?(?:Rs\.?|PKR)?\s?\d[\d,]*)?|\b\d[\d,]*(?:\.\d{1,2})?\s*(?:usd|dollars?|pkr|rupees?|lakh\w*|crore\w*|thousand)\b|\b\d[\d,]*(?:\.\d{1,2})?\s*(?:\/\s?ft|per\s+(?:foot|lineal\s+foot|linear\s+foot|ton|day|hour|visit)|a\s+foot|per\s+(?:month|year)|\/\s?mo(?:nth)?)\b/gi;

const THINKING_BLOCK = /(?:<(?:think(?:ing)?|reasoning|thought|antml:thinking)\b[^>]*>|<\/(?:think(?:ing)?|reasoning|thought|antml:thinking)>)[\s\S]*?(?:<\/(?:think(?:ing)?|reasoning|thought|antml:thinking)>|[\n]{2}<|$)/gi;
const THINKING_LABEL =
  /^[ \t]*(?:\[[ \t]*(?:thinking|reasoning|plan|scratchpad)[ \t]*\]|(?:thinking|reasoning|my thoughts|internal monologue)[ \t]*:)[ \t]*/im;
const THINKING_NARRATION =
  /^[ \t]*(?:let\s+me\s+(?:think|see|break|walk)|i\s+(?:need|must)\s+to\s+(?:answer|respond|think|check)|first[,']?\s+i\s+(?:need|should|will)|the\s+user\s+(?:wants|is\s+asking|needs))[^\n]*\n?/im;

/** Left verbatim: the widget reads these to highlight the CTA and prefill a service. */
const SENTINEL = /\[\[(?:BOOK|SERVICE:[a-z0-9-]+)\]\]/gi;

const SAFE_COST_LINE =
  "Cost depends on the tonnage, the part that has failed, the pipe run and how we reach the outdoor unit, so we do not put a number on it before seeing it ourselves \u2014 that is what the free inspection is for.";

export type Sanitized = { text: string; changed: boolean; violations: string[] };

/* Some reasoning models write their plan into the answer channel itself, where a
   block matcher cannot see it. Anything along these lines at the head of a reply is
   the model talking to itself, never something a customer should read, so it comes
   off line by line until a real sentence starts. */
const PLAN_LEAD = /^[ \t]*(?:\d{1,2}[.)]\s*)?(?:\*\*)?(?:my (?:role|task|goal|job|approach|plan)|i (?:need|have|must|should|will|’ll|'ll)\b|let me\b|first[,\s]|actually[,\s]|okay[,\s]|so,? i\b|the (?:user|customer) (?:is asking|wants|needs)|i(?:’ll|'ll) (?:answer|respond|say|start))\b/i;

function stripPlanNarration(text: string): { text: string; hit: boolean } {
  const lines = text.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index++;
      continue;
    }
    const numbered = /^\d{1,2}[.)]\s/.test(line);
    if (!numbered && !PLAN_LEAD.test(line)) break;
    index++;
  }
  const kept = lines.slice(index).join("\n").trim();
  return { text: kept, hit: index > 0 && kept !== text.trim() };
}


/** Plain text is all the bubble can render, so markdown is flattened, not parsed. */
function flatten(text: string): string {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/`{1,3}([^`\n]*)`{1,3}/g, "$1")
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "\u2022 ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

/** Replaces the offending sentence instead of deleting it, so the prose still reads. */
function scrubPrices(text: string): { text: string; hit: boolean } {
  let hit = false;
  let inserted = false;
  const kept = text.split(/(?<=[.!?])\s+/).map((sentence) => {
    PRICE.lastIndex = 0;
    if (!PRICE.test(sentence)) return sentence;
    hit = true;
    if (inserted) return "";
    // if the sentence next to it already explains what drives cost, deleting the
    // number is enough; pasting the standard line on top reads like a doubled reply
    inserted = true;
    return SAFE_COST_LINE;
  });
  let outLines = kept.filter(Boolean);
  if (inserted) {
    const index = outLines.indexOf(SAFE_COST_LINE);
    const rest = outLines.filter((_, n) => n !== index).join(" ");
    // no point stating what drives cost twice
    if (/depends on|comes down to|after (the |an? )?(inspection|visit)/i.test(rest)) outLines.splice(index, 1);
  }
  return { text: outLines.join(" ").replace(/\s+/g, " ").trim(), hit };
}

export function sanitizeAnswer(raw: string): Sanitized {
  const violations: string[] = [];
  let text = raw;

  if (THINKING_BLOCK.test(text)) {
    violations.push("thinking block");
    text = text.replace(THINKING_BLOCK, "");
  }
  THINKING_BLOCK.lastIndex = 0;
  if (THINKING_LABEL.test(text)) {
    violations.push("thinking label");
    text = text.replace(THINKING_LABEL, "");
  }
  THINKING_LABEL.lastIndex = 0;
  if (THINKING_NARRATION.test(text)) {
    violations.push("reasoning narrated");
    text = text.replace(THINKING_NARRATION, "");
  }
  THINKING_NARRATION.lastIndex = 0;

  const planned = stripPlanNarration(text);
  if (planned.hit) violations.push("internal plan removed");
  const scrubbed = scrubPrices(flatten(planned.text));
  if (scrubbed.hit) violations.push("price figure removed");

  const cleaned = scrubbed.text.trim() || SAFE_COST_LINE;
  return { text: cleaned, changed: cleaned !== raw.trim(), violations };
}

/* ── Streaming scrubber ──────────────────────────────────────────────────
   The block pass above runs when the answer is finished, which would still let
   a model's chain of thought flash on screen. This drops it before any token
   reaches the browser. Tags are assembled rather than written literally so this
   file never contains a real model tag for tooling and searches to trip over. */
const OPEN_TOKEN = "<" + "think" + ">";
const CLOSE_TOKEN = "<" + "/think>";
const BLANK_LINE = "\n\n";
const LINE_BREAK = "\n";

export function createThinkScrubber() {
  let hidden = false;
  let carry = "";

  return {
    push(text: string): string {
      let buffer = carry + text;
      carry = "";
      let visible = "";

      for (;;) {
        if (!buffer) return visible;

        if (hidden) {
          const end = buffer.indexOf(CLOSE_TOKEN);
          if (end !== -1) {
            hidden = false;
            buffer = buffer.slice(end + CLOSE_TOKEN.length);
            continue;
          }
          // Streamed chunks are arbitrary. The close tag arrives whole, broken
          // across two frames, or alone on a line padded with newlines — that
          // last case is what once leaked a bare close tag into a chat bubble, so:
          // as the end of the hidden run, and fall back to a blank line for
          // models that never close it.
          for (let len = CLOSE_TOKEN.length; len > 1; len--) {
            const tail = buffer.slice(-len);
            if (CLOSE_TOKEN.startsWith(tail)) {
              buffer = buffer.slice(0, buffer.length - len);
              carry = tail;
              break;
            }
          }
          const lines = buffer.split(LINE_BREAK);
          let resumed = false;
          for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed) continue;
            if (trimmed === CLOSE_TOKEN || trimmed === CLOSE_TOKEN.slice(0, -1) || trimmed === CLOSE_TOKEN.slice(1)) {
              buffer = lines.slice(i + 1).join(LINE_BREAK);
              resumed = true;
              break;
            }
          }
          if (resumed) continue;
          const gap = buffer.indexOf(BLANK_LINE);
          if (gap !== -1) {
            hidden = false;
            buffer = buffer.slice(gap + BLANK_LINE.length);
            continue;
          }
          return visible;
        }

        const start = buffer.indexOf(OPEN_TOKEN);
        if (start === -1) {
          // Hold back a trailing fragment only if it actually starts the tag.
          // Matching every prefix swallowed ordinary letters ("t", "h") and ate
          // the first character of answers that began with a capital I.
          if (buffer.endsWith(OPEN_TOKEN.slice(0, -1)) || buffer.endsWith(OPEN_TOKEN.slice(0, 2))) {
            const len = buffer.endsWith(OPEN_TOKEN.slice(0, -1)) ? OPEN_TOKEN.length - 1 : 2;
            carry = buffer.slice(buffer.length - len);
            buffer = buffer.slice(0, buffer.length - len);
          }
          return visible + buffer;
        }

        visible += buffer.slice(0, start);
        buffer = buffer.slice(start + OPEN_TOKEN.length);
        hidden = true;
      }
    },
  };
}
