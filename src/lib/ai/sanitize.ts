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
const PLAN_LEAD = /^[ \t]*(?:\d{1,2}[.)]\s*)?(?:\*\*)?(?:my (?:role|task|goal|job|approach|plan)|let me\b|however[,\s]+i\b|but\s+i\s+(?:need|should|must|will)\b|so,?\s*i\s+(?:need|should|must|will|’ll|'ll)|therefore,?\s*i\b|note that i\b|given that i\b|i (?:need|have|must|should|’ll|'ll|am going to) (?:to\s+)?(?:answer|respond|reply|say|start|keep|stay|follow|mention|avoid|be)\b|i (?:must|need to) (?:stay|keep|follow)\b|stay in (?:character|role)|as (?:the|an|a) (?:assistant|helper|website|chatbot)|the (?:instructions|system prompt|rules|brief) (?:say|tell|state|require)|the (?:user|customer) (?:is asking|wants|needs)|first[,\s]+i\b|second[,\s]+i\b|next[,\s]i\b|now[,\s]i\b|actually[,\s]+i\b)[^\n]*\n?/i;
/* A line like "I should do this:" or "Plan:" is a heading the model wrote for
   itself. Only short ones count, so a real sentence that happens to start with
   "I will" is never mistaken for it. */
const PLAN_HEADER = /^[ \t]*(?:\*\*)?[ \t]*[^\n]{0,72}:[ \t]*(?:\*\*)?[ \t]*$/;

/* The worst shape the gateway has produced: the entire reply is the model's own
   checklist, written on one line after "I should:". Nothing in it belongs to a
   customer, and cutting the lead line would leave a numbered plan behind, so the
   whole reply is dropped and the caller substitutes an honest failure line. */
const PLAN_AS_REPLY = /^[ \t]*(?:\*\*)?i (?:should|need to|need|must|have to|am going to)\b[^\n]{0,60}:(?:[^\n]*\s\d{1,2}[.)][^\n]*)+$/i;

/* Enumerating the verbs a model uses while talking about its own answer never ends, so
   the rule is semantic instead: an opening that is first person about what the reply
   will do ("I should give a brief answer", "I'll keep this short") plus vocabulary that
   only appears in that kind of sentence. A real answer to a customer does not describe
   its own length, tone or formatting. */
const META_OPEN = /^[ \t]*(?:\*\*)?[ \t]*(?:so[,\s]+|well[,\s]+|however[,\s]+)?i (?:should|need to|need|must|have to|\u2019ll|'ll|will|am going to|’m going to)\b/i;
const ABOUT_THE_ANSWER = /\b(?:answer|reply|respond|response|sentence|paragraph|brief|short|length|tone|format|markdown|bullet|emoji|emojis|character|role|instructions?|policy|guideline|constraint)\b/i;

export function readsAsNarration(text: string): boolean {
  const first = text.trim();
  if (!META_OPEN.test(first)) return false;
  if (first.split(/\s+/).length > 90) return false;
  return ABOUT_THE_ANSWER.test(first);
}

/* MiniMax-style replies put the thinking in the answer channel *between* real
   sentences, so a head-only strip is not enough. Each sentence is judged on its own:
   a sentence about how the reply should be written, or about the request being off
   topic, is the model talking to itself and never belongs in front of a customer. */
const META_SENTENCE = /(?:\bi (?:should|need to|need|must|have to|am going to|will|\u2019ll|'ll)\b[^.!?]{0,80}\b(?:answer|respond|reply|say|start|keep|stay|follow|mention|avoid|be|produce|give|format|stick|note)\b)|(?:\bthis (?:request|question|prompt) (?:doesn'?t|does not|don'?t) (?:seem )?to be about\b)|(?:\bit'?s asking me to\b)|(?:\bmy (?:role|task|job|instructions?|guidelines?)\b)|(?:\bas (?:an?|the) (?:ai|assistant|helper|chatbot)\b)|(?:\bstay in (?:character|role)\b)|(?:\bthe (?:system )?(?:instructions|rules|brief|policy) (?:say|tell|state|require|forbid)\b)|(?:\b(?:emoji|emojis|markdown|bullet points?|formatting|tone)\b[^.!?]{0,40}\b(?:skip|use|avoid|add|include|leave out|leave out|remove|keep|drop)\b)|(?:\b(?:skip|use|avoid|add|drop|remove)\b[^.!?]{0,40}\b(?:emoji|emojis|markdown|bullet points?)\b)/i;

function stripNarrationSentences(text: string): { text: string; hit: boolean } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) return { text, hit: false };
  const kept = sentences.filter((sentence) => !META_SENTENCE.test(sentence));
  if (kept.length === sentences.length) return { text, hit: false };
  return { text: kept.join(" ").trim(), hit: true };
}

function stripPlanNarration(text: string): { text: string; hit: boolean } {
  if (PLAN_AS_REPLY.test(text.trim()) || readsAsNarration(text)) return { text: "", hit: true };
  const lines = text.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index++;
      continue;
    }
    const numbered = /^\d{1,2}[.)]\s/.test(line);
    if (!numbered && !PLAN_LEAD.test(line) && !PLAN_HEADER.test(line)) break;
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
  const spoken = stripNarrationSentences(planned.text);
  if (spoken.hit) violations.push("model narration removed");
  const scrubbed = scrubPrices(flatten(spoken.text));
  if (scrubbed.hit) violations.push("price figure removed");

  // a deleted price leaves a hole that needs the standard cost sentence; a reply that
  // was nothing but narration leaves nothing to answer with, and the caller says so
  const cleaned = scrubbed.text.trim() || (scrubbed.hit ? SAFE_COST_LINE : "");
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
