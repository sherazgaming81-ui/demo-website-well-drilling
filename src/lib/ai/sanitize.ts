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

/* The aside a model writes to itself about language or length ("(If you prefer
   English, let me know.)") is not an answer, and leaving it in front of the real
   greeting read like the greeting had been said twice with no space. Removed, and the
   seam closed. Leading asides go first; one glued to the end of a sentence — ")" with no
   space before the next capital — is the seam itself, so it goes too. */
const META_ASIDE = /^[\s\-*]*(?:\((?:[^)]{0,120})\)|\[[^\]]{0,120}\])\s*(?=[A-Z\u0600-\u06FF])/;
const GLUED_ASIDE = /[(\[]([^)\]]{0,120})[)\]](?=[A-Z\u0600-\u06FF])/g;
const META_PHRASE = /\b\w+\b[^.!?\n]{0,60}\b(english|urdu|language|tone|length|format|emoji|markdown|sentence|sentences|words?)\b[^.!?\n]{0,40}[.!?]?\s*$/i;

function stripMetaAsides(text: string): { text: string; hit: boolean } {
  let out = text.trim();
  let hit = false;
  for (let i = 0; i < 2; i++) {
    const aside = META_ASIDE.exec(out);
    if (aside && META_PHRASE.test(aside[0])) {
      out = out.slice(aside[0].length).trim();
      hit = true;
      continue;
    }
    break;
  }
  // "(If you prefer English, let me know.)Wa alaikum salam!" — the aside sits between two
  // real sentences, so the leading rule above never reaches it.
  const glued = out.replace(GLUED_ASIDE, (whole, inner: string) => (META_PHRASE.test(inner) ? "" : whole));
  if (glued !== out) {
    out = glued.replace(/\s{2,}/g, " ").replace(/[ \t]+([.!?])/g, "$1").trim();
    hit = true;
  }
  return { text: out, hit };
}

/* Two greetings in one message (same shape, slightly different words) is a model
   stutter, not a style. Only the first two sentences are compared, and only when both
   look like greetings, so a real answer can never be edited by this rule. */
const GREETINGISH = /^(?:salaam|salam|assalamu|hello|hi|hey|ji|wa[ -]?alaikum|kaise|kaisay|bataie?n?|kya masla)/i;
function dropStutteredGreeting(text: string): { text: string; hit: boolean } {
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length < 2) return { text, hit: false };
  const [first, second] = parts;
  if (!GREETINGISH.test(first.trim()) || !GREETINGISH.test(second.trim())) return { text, hit: false };
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z\u0600-\u06FF0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const a = new Set(norm(first));
  const b = norm(second);
  const overlap = b.filter((word) => a.has(word)).length;
  if (b.length === 0 || overlap / b.length < 0.34) return { text, hit: false };
  return { text: parts.slice(1).join(" ").trim(), hit: true };
}

/* ------------------------------------------- the model showing its draft work */
/*
 * Two shapes came back from the gateway when a customer asked for the WhatsApp link.
 * One wrote a complete answer and then argued with itself about a page tag:
 *   "…hum turant reply denge. 😊 [[BOOK]]? Nahi, bas link chahiye tha. Koi baat nahi."
 * The other argued, then restated the whole answer under a label:
 *   "…slot hold kar lega. 👍 ? Nahi, sirf book token. … Final: "WhatsApp number: 0300…""
 * Both are the model thinking out loud, and the second one means the good sentence is
 * at the END — so the label is cut before anything looks at the front of the reply.
 *
 * A soft tell (a sentence starting "nahi", "wait", "actually", or talking about what
 * "I will" write) is only the model when it says nothing about the air conditioner, so
 * "Par pehle breaker off kar dein" survives and "Nahi, bas number diya" does not. The
 * hard tells — a stray bracket pair, or the words token, sentinel, emit — never belong
 * in an answer to a human at all, so those cut on their own.
 */
const FINAL_LABEL =
  /(?:^|(?<=[.!?\n]))[ \t]*(?:final|actual|revised|corrected)(?:[ \t]+(?:answer|reply|response|version|text))?[ \t]*:[ \t]*["'“”«»?]?[ \t]*/i;
const HARD_TELL = /\[\[|\b(?:tokens?|sentinels?|emit|emits|emitted|emitting|plumbing|scratchpad|meta)\b/i;
const SOFT_TELL_START = /^(?:\?[ \t]*)?(?:nahi|nahin|nhi|wait|hold on|oops|hmm+|actually|lekin|par|sorry|hmm|second thought|revised|revision|soch)\b/i;
const SELF_INTENT = /\bi (?:should|shouldn'?t|must|need to|have to|will|won'?t|am going to|decided|thought|think|reckon|just)\b/i;
/* Sentences the model only ever writes to itself about the plumbing. Every phrase here
   was copied out of a live answer, and none of them can appear in a reply to a customer. */
/* "…[[BOOK]]  <-- this line is not part of the reply; ignore it." — a note the model
   leaves itself in the margin. A URL never looks like that, so the arrow is safe to cut
   on, and it stops at the first full stop instead of eating the line: the sentences that
   follow are the evidence the rules below need in order to recognise the rest of the draft. */
const DRAFT_NOTE = /[ \t]*<--+[^.!?\n]*(?:[.!?]|$)/g;
const PROTOCOL_TELL =
  /no tag needed|no tags?\b|not part of (?:the|your|this) reply|ignore (?:it|this)|the (?:tag|reply|answer|instruction)s? (?:say|says|should|need)|tag goes on|only the link|just the link\b/i;
/* Left-right whitespace-only debris and the page tags. The tags are taken out before any
   sentence is judged — they are plumbing, and a [[BOOK]] parked after an honest answer is
   not evidence that the answer is a draft — and put back untouched afterwards. */
const PAGE_TAG = /\[\[(?:BOOK|SERVICE:[a-z0-9-]+)\]\]/gi;

function tidy(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    // a "?" or "—" the model dropped at the seam of its own edit, on its own
    .replace(/(^|\s)[?!—–](?=\s|$)/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/* "Final: <the answer>" means the model threw the first half away, so the half that
 * survives is the one at the END — which is why this runs before anything looks at the
 * head of the reply. Only a label that opens a sentence counts, so "Testing final: " in
 * a real answer is never mistaken for the model's own seam.
 */
function unwrapFinalDraft(text: string): { text: string; hit: boolean } {
  const raw = text.trim();
  const match = FINAL_LABEL.exec(raw);
  if (!match) return { text, hit: false };
  const tail = tidy(raw.slice(match.index + match[0].length).replace(/^["'“»«]+/, "").replace(/["'”«»]+$/, ""));
  // nothing worth keeping behind the label: leave the reply to the other passes
  if (tail.length < 16 || tail.split(/\s+/).length < 3) return { text, hit: false };
  return { text: tail, hit: true };
}

function isModelDebate(sentence: string): boolean {
  const clean = sentence.trim();
  if (!clean) return false;
  // a bare "?" or "—" is debris from the edit; an emoji on its own is just tone
  if (!/[\p{L}\p{N}]/u.test(clean)) return !/\p{Extended_Pictographic}/u.test(clean);
  if (HARD_TELL.test(clean)) return true;
  if (ABOUT_THE_AC.test(clean)) return false;
  // "😊 Nahi, bas link chahiye tha." starts with an emoji, not the tell itself
  const lead = clean.replace(/^[^\p{L}\p{N}]+/u, "");
  const short = clean.split(/\s+/).length <= 12;
  // "No, wait customer just said salaam." — a reversal that is only ever the model
  // changing its mind; a plain "No, aaj nahi milega" answer has no deliberation word
  const reversal = /^no\b[,.]?\s/i.test(lead) && /\b(?:wait|actually|let me|hold on|i mean|correction|never mind|hmm|oops)\b/i.test(clean);
  return SOFT_TELL_START.test(lead) || reversal || SELF_INTENT.test(clean) || (short && PROTOCOL_TELL.test(clean));
}

/* Whatever the model wrote between the two copies of its own answer is its draft, and the
   shape is unmistakable: the last sentence repeats something already said. Nothing about
   this business is ever answered twice in one bubble, so when it happens the middle goes
   and the first copy stays. Glue like "Correct.WhatsApp link: …" is forgiven by comparing
   the letters only. */
const keyOf = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const wordsOf = (value: string) =>
  value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((word) => word.length > 2);
/* "nahi" is the difference between an answer and a refusal, so two sentences that
   disagree are never treated as copies of each other however well their words overlap. */
const NEGATION = /\b(?:nahi|nahin|nhi|not|never|without|band)\b/i;
function sameSentence(first: string, second: string): boolean {
  const a = wordsOf(first);
  const b = wordsOf(second);
  if (Math.min(a.length, b.length) < 4) return false;
  if (NEGATION.test(first) !== NEGATION.test(second)) return false;
  const seen = new Set(a);
  const shared = b.filter((word) => seen.has(word)).length;
  return shared / Math.min(a.length, b.length) >= 0.75;
}
function findRepeatCut(sentences: string[]): number {
  if (sentences.length < 2) return -1;
  for (let later = 1; later < sentences.length; later++) {
    for (let earlier = 0; earlier < later; earlier++) {
      const before = keyOf(sentences[earlier]);
      const after = keyOf(sentences[later]);
      // containment covers an exact copy with a word glued on ("Correct.WhatsApp link…");
      // word overlap covers the reworded copy a degenerate loop produces. Both halves have
      // to be sentences: an empty key is inside every string there is.
      if (before.length >= 24 && after.length >= 24 && (after.includes(before) || before.includes(after))) return earlier + 1;
      if (sameSentence(sentences[earlier], sentences[later])) return earlier + 1;
    }
  }
  return -1;
}

function cutDebateTail(text: string): { text: string; hit: boolean } {
  const tags = [...new Set(text.match(PAGE_TAG) ?? [])];
  const body = tidy(text.replace(PAGE_TAG, ""));
  // a line break is as good a sentence end as a full stop here: the model writes its
  // draft on the line after the answer, and a URL or an emoji has no punctuation to split on
  const sentences = body.split(/(?:\n+|(?<=[.!?])\s+)/).filter(Boolean);
  if (sentences.length < 2) return { text, hit: false };
  let debateAt = -1;
  for (let index = 1; index < sentences.length; index++) {
    if (isModelDebate(sentences[index])) {
      debateAt = index;
      break;
    }
  }
  const repeatAt = findRepeatCut(sentences);
  const first = debateAt === -1 ? repeatAt : repeatAt === -1 ? debateAt : Math.min(debateAt, repeatAt);
  if (first === -1) return { text, hit: false };
  const kept = tidy(sentences.slice(0, first).join(" "));
  const dropped = sentences.slice(first).join(" ").trim();
  // never trade an answer for a hole: the half that stays has to still be a sentence
  if (kept.length < 20 || dropped.length < 6) return { text, hit: false };
  return { text: tags.length ? `${kept}\n${tags.join("\n")}` : kept, hit: true };
}

/* ------------------------------------------------- the model talking about itself */
/*
 * A reply that opens by describing how it will be written ("I need to respond in
 * Hinglish, keeping it short (under 60 words), warm and professional…") is not an
 * answer. The tell is not the first-person start — "I will check the capacitor before
 * I answer you" is a fine answer — it is a sentence that talks about the *reply* while
 * saying nothing about the air conditioner. So both halves have to be true, and two or
 * more style words have to appear, before a sentence is removed.
 */
const SELF_TALK_OPEN = /^[\s\-*"]*(?:\*\*)?\s*(?:so[, ]+|well[, ]+|however[, ]+|first[, ]+|okay[, ]+)?i(?:\u2019|')?m?\s+(?:should|need|have|must|will|shall|\u2019|')?(?:\s*(?:to|going\s+to|gonna))?\s*\w*|^(?:so[, ]+|well[, ]+)?let\s+me\b/i;
const STYLE_WORDS = /\b(hinglish|english|urdu|roman|language|tone|format|formatting|markdown|bullet|bullets|emoji|emojis|greeting|polite|professional|warm|casual|friendly|brief|short|length|words|word\s*limit|sentences?|characters?|under\s+\d+|avoid|not\s+quote|price|prices|quoting|rules?|instructions?|guidelines?|policy|system\s*prompt|stay\s+in\s*character|my\s+(?:role|task|job|goal|approach|plan))\b/gi;
const ABOUT_THE_AC = /\b(ac|air\s*conditioner|cooling|not\s+cool|gas|leak|charge|compressor|capacitor|pcb|board|coil|filter|drain|water|drip|noise|service|jet\s*clean|install|inverter|duct|cassette|amc|ton|technician|inspection|visit|area|booking|book|slot|quote)\b/i;

function isSelfTalk(sentence: string): boolean {
  const clean = sentence.trim();
  if (clean.length < 12) return false;
  if (!SELF_TALK_OPEN.test(clean)) return false;
  const style = clean.match(STYLE_WORDS);
  return !!style && new Set(style.map((word) => word.toLowerCase())).size >= 2 && !ABOUT_THE_AC.test(clean);
}

/**
 * Removed sentence by sentence from the front, so a long monologue about the reply
 * cannot hide behind a word-count guard, and one real sentence further down survives.
 */
function stripSelfTalk(text: string): { text: string; hit: boolean } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  let index = 0;
  while (index < sentences.length && isSelfTalk(sentences[index])) index++;
  if (index === 0) return { text, hit: false };
  return { text: sentences.slice(index).join(" ").trim(), hit: true };
}

function stripPlanNarration(raw: string): { text: string; hit: boolean; notes: string[] } {
  const notes: string[] = [];
  let text = raw;
  const finalDraft = unwrapFinalDraft(text);
  if (finalDraft.hit) {
    text = finalDraft.text;
    notes.push("drafted reply unwrapped");
  }
  const selfTalk = stripSelfTalk(text);
  if (selfTalk.hit) {
    text = selfTalk.text;
    notes.push("self-talk removed");
  }
  const aside = stripMetaAsides(text);
  if (aside.hit) text = aside.text;
  if (PLAN_AS_REPLY.test(text.trim()) || readsAsNarration(text)) return { text: "", hit: true, notes };
  const stutter = dropStutteredGreeting(text);
  if (stutter.hit) text = stutter.text;
  const debate = cutDebateTail(text);
  if (debate.hit) {
    text = debate.text;
    notes.push("model debate removed");
  }
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
  return { text: kept, hit: (index > 0 || selfTalk.hit || aside.hit || stutter.hit || debate.hit || finalDraft.hit) && kept !== raw.trim(), notes };
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

  // "<-- this line is not part of the reply" is a note the model leaves itself in the
  // margin of a message. It is never part of an answer, so it goes before anything else
  // looks at the text — and it is cut to the end of its line, where the draft usually
  // argues with itself.
  DRAFT_NOTE.lastIndex = 0;
  if (DRAFT_NOTE.test(text)) {
    violations.push("margin note removed");
    text = text.replace(DRAFT_NOTE, "");
  }

  const planned = stripPlanNarration(text);
  if (planned.hit) violations.push("internal plan removed");
  violations.push(...planned.notes);
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
