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
  // "I will answer your gas question on the visit" is a reply, not a plan — a sentence
  // about the unit or the job is only self-talk when it says nothing about them.
  if (ABOUT_THE_AC.test(first)) return false;
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
  // "I will check the capacitor before I answer you" matches the narration shape but is
  // a real AC sentence — a sentence about the unit itself is always kept.
  const kept = sentences.filter((sentence) => !(META_SENTENCE.test(sentence) && !ABOUT_THE_AC.test(sentence)));
  if (kept.length === sentences.length) return { text, hit: false };
  return { text: kept.join(" ").trim(), hit: true };
}

/* The aside a model writes to itself about language or length ("(If you prefer
   English, let me know.)") is not an answer, and leaving it in front of the real
   greeting read like the greeting had been said twice with no space. Removed, and the
   seam closed. */
const META_ASIDE = /^[\s\-*]*(?:\((?:[^)]{0,120})\)|\[[^\]]{0,120}\])\s*(?=[A-Z\u0600-\u06FF])/;
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

/* The one decision the model keeps narrating in Hinglish is whether to attach the
   invisible [[BOOK]] / [[SERVICE:x]] marks: "Nahi, sirf book token… Haan, emit karna
   hai… Lekin service emit nahi karna… Final: <repeats the answer>". A customer reply
   about an air conditioner never discusses tokens or emitting, so any sentence that
   does is the model talking to itself and comes out whole. */
const MARK_TALK = /\b(?:token|tokens|emit|emits|emitted|emitting|sentinel|sentinels)\b/i;
/* A sentence about how the reply itself is written ("The reply is short and direct.",
   "keep it polite") is narration in any language — a customer sentence about an AC never
   describes its own brevity. The dash-trail is the same animal wearing a moustache:
   "👍 — wait, no emoji." followed by a verbatim re-do of the whole answer. */
const SELF_DESCRIBE = /\b(?:reply|answer|response|message)\b[^.!?)]{0,44}\b(?:is|will be|should be|must be|needs? to be|stays?|was|had to be)\b[^.!?)]{0,44}\b(?:short|brief|concise|direct|polite|warm|clear|simple|friendly|professional|under \d+|Hinglish|English|one greeting|two|three)\b|\b(?:keep|make|write|start|end)\b[^.!?)]{0,30}\b(?:it|this|the reply|the answer)\b[^.!?)]{0,30}\b(?:short|brief|direct|concise|polite|warm|under \d+|professional|Hinglish|simple)\b/i;
const DASH_TRAIL = /\s*[—–]\s*(?:wait\b|no\b|actually\b|oh\b|hold on\b|scratch|oops\b|the reply\b|the answer\b|i (?:should|need to|must|will|’ll|'ll)\b|let me\b(?!\s+know))[^—–!?]*/gi;
/* An answer the model re-types after its own correction: same words, maybe a different
   emoji. First copy wins, verbatim repeats go. Sentences need ≥4 words to dedupe so a
   short honest echo ("Bilkul. Bilkul.") is never touched. */
const NORM_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu;
function normKey(sentence: string): string {
  return sentence
    .replace(NORM_EMOJI, "")
    .toLowerCase()
    .replace(/\[\[[^\]]+\]\]/g, "")
    .replace(/[^a-z\u0600-\u06FF0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function collapseRepeats(text: string): { text: string; hit: boolean } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) return { text, hit: false };
  const seen = new Set<string>();
  const kept = sentences.filter((sentence) => {
    const key = normKey(sentence);
    if (key.split(" ").length < 4 || key.length < 14) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (kept.length === sentences.length) return { text, hit: false };
  return { text: kept.join(" ").replace(/\s+/g, " ").trim(), hit: true };
}
/* The [[..]] marks the widget reads must survive even when the sentence they were glued
   to is deleted, or the CTA highlight silently dies with the narration. */
const MARKS = /\[\[(?:BOOK|SERVICE:[a-z0-9-]+)\]\]/gi;
function keepMarks(sentence: string, sinks: string[]): string {
  for (const mark of sentence.match(MARKS) ?? []) sinks.push(mark);
  return sentence.replace(MARKS, " ");
}
function restoreMarks(text: string, marks: string[]): string {
  const missing = marks.filter((mark) => !text.includes(mark));
  return missing.length ? `${text} ${missing.join(" ")}`.trim() : text;
}
/* An interjection of self-decision that survives only next to a removed line, and only
   when it is too short to carry information: "Bas number diya." — five words, all plan. */
const SELF_DECISION_ECHO = /^(?:\*+\s*)?(?:bas|nahi|nahin|haan|han|theek|thik|ok|okay|wait|ab)\b/i;

function dropMarkTalk(text: string): { text: string; hit: boolean } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) return { text, hit: false };
  const sinks: string[] = [];
  const bare = sentences.map((sentence) => {
    // judge the sentence without its leading "👍 [[BOOK]]" garnish: the mark rides along
    // with whatever sentence ends first, it is not part of the wording
    const stripped = sentence.replace(/^[\s.,:;!?()\-]*(?:(?:\[\[[^\]]+\]\]|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}])[\s.,:;!?()\-]*)*/u, "");
    return normKey(stripped) || normKey(sentence);
  });
  const removed = sentences.map((sentence, i) => MARK_TALK.test(sentence) || SELF_DESCRIBE.test(bare[i]));
  // a bare "👍 ?" left between the real answer and the model's muttering is punctuation debris —
  // but the emoji riding with it is the reply's own closer, so it is kept and re-attached
  const tail: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    if (removed[i] || bare[i]) continue;
    const without = sentences[i].replace(MARKS, " ").replace(/\s+/g, " ").trim();
    // debris is what is left when the marks are out: no letter and no digit anywhere,
    // only emoji and punctuation. Length alone misjudged surrogate pairs and double spaces.
    if (/[\p{L}\p{N}]/u.test(without)) continue;
    removed[i] = true;
    for (const mark of sentences[i].match(MARKS) ?? []) sinks.push(mark);
    tail.push(...(without.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []));
  }
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < sentences.length; i++) {
      if (removed[i]) continue;
      const neighbour = (i > 0 && removed[i - 1]) || (i < sentences.length - 1 && removed[i + 1]);
      if (!neighbour) continue;
      const words = bare[i].split(" ");
      // talking to itself, not to the customer: a sentence that says "aap" is an answer
      if (words.length <= 6 && SELF_DECISION_ECHO.test(bare[i]) && !/\baap\b|\bapko\b|\bapk?\b/i.test(bare[i])) removed[i] = true;
    }
  }
  if (!removed.some(Boolean)) return { text, hit: false };
  const kept = `${sentences
    .map((sentence, i) => (removed[i] ? keepMarks(sentence, sinks) : sentence))
    .filter((_, i) => !removed[i])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()}${tail.length ? ` ${tail.join("")}` : ""}`;
  return { text: restoreMarks(kept, sinks), hit: true };
}

/* Some replies deliberate first and then print the real answer after a label —
   "Final: "…"". Everything the label introduces, and nothing before it, is what the
   customer should read. Only trusted when the head actually contains model-talk or the
   tail is wrapped in quotes, so a genuine sentence like "Final report: kal milegi" is
   never cut. */
const FINAL_LABEL = /\bfinal(?:\s+(?:answer|reply|message|version))?\s*:\s*["'\u201C\u201D\u2018\u2019]?\s*/gi;
function takeFinalAnswer(text: string): { text: string; hit: boolean } {
  let match: RegExpExecArray | null = null;
  for (const found of text.matchAll(FINAL_LABEL)) match = found;
  if (!match || match.index === 0) return { text, hit: false };
  const head = text.slice(0, match.index);
  let tail = text.slice(match.index + match[0].length).trim();
  const quoted = /^["'\u201C\u2018][\s\S]*["'\u201D\u2019]$/.test(tail);
  if (!quoted && !MARK_TALK.test(head) && !/\bdraft|plan\b/i.test(head)) return { text, hit: false };
  tail = tail.replace(/^["'\u201C\u2018]\s*/, "").replace(/\s*["'\u201D\u2019]+$/, "").trim();
  if (tail.split(/\s+/).length < 3) return { text, hit: false };
  return { text: tail, hit: true };
}

/* The shapes the gateway keeps producing all end with the model addressing itself:
   "…[[BOOK]] nahi, bas number chahiye tha", "Wait, I need to just give the number",
   "The customer asked… I gave…", "No need for…", "The reply is clean." The vocabulary
   is unbounded — every day it is a new wording — so the rule is structural: the real
   answer is always the first thing it wrote, and everything from the first cue of
   self-address onward is the workshop floor talking. Cut at the cue, keep the marks and
   the closing emoji that were glued to it. A cue at the very start of a reply is not a
   cut (nothing real would be lost before it); the other passes judge that. */
const DELIBERATION =
  /\b(?:chahiye tha|karna tha|poochna tha|likhna tha|dekhna tha|kar raha tha|bas number diya)\b|\b(?:wait|hold on|oops)[,.]|\bi (?:gave|said|wrote|listed|sent|decided)\b|\bi (?:should|must|need to|’ll|'ll|will)\b[^.!?]{0,30}\b(?:just|only|not\b|skip|omit|add|include|emit|give|send|keep it|start|open)\b|\bthe (?:customer|user|visitor) (?:asked|wanted|is asking|needs|said|mentioned)\b|\bthat'?s it\b|\bno need for\b|\b(?:reply|answer|message)\b[^.!?]{0,24}\bis\b[^.!?]{0,24}\b(?:clean|short|direct|complete|done|fine|perfect|brief|ready)\b|\bit (?:is|'?s) better\b[^.!?]{0,24}\bto (?:ask|add|include|start|open)\b/i;
function truncateAtDeliberation(text: string): { text: string; hit: boolean } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) return { text, hit: false };
  const cue = sentences.findIndex((sentence, i) => i > 0 && DELIBERATION.test(normKey(sentence.replace(MARKS, " "))));
  if (cue < 1) return { text, hit: false };
  const sinks: string[] = [];
  const kept = sentences.slice(0, cue);
  // the cue sentence's own garnish — a closing emoji and any marks — belongs to the answer
  const garnish = sentences[cue].slice(0, sentences[cue].length - sentences[cue].replace(/^[\s.,:;!?()\-]*(?:(?:\[\[[^\]]+\]\]|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}])[\s.,:;!?()\-]*)*/u, "").length);
  const closer = garnish.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  if (closer) kept.push(closer.join(""));
  for (const chunk of sentences.slice(cue)) for (const mark of chunk.match(MARKS) ?? []) sinks.push(mark);
  const joined = `${kept.join(" ").replace(/\s+/g, " ").trim()}${sinks.length ? " " : ""}${[...new Set(sinks)].join(" ")}`.trim();
  return { text: joined, hit: true };
}

function stripPlanNarration(raw: string): { text: string; hit: boolean } {
  let text = raw;
  // cut the reply at the first sentence where the model turns to address itself
  const cut = truncateAtDeliberation(text);
  if (cut.hit) text = cut.text;
  // "— wait, no emoji." trails are self-corrections, not prose: cut the trail first so
  // the re-typed answer behind it can be collapsed as a repeat below
  const trailed = text.replace(DASH_TRAIL, " ");
  if (trailed.trim() !== text.trim()) text = trailed;
  // a reply that repeats itself after "Final:" — keep only the answer the label introduces
  const finalPass = takeFinalAnswer(text);
  if (finalPass.hit) text = finalPass.text;
  const selfTalk = stripSelfTalk(text);
  if (selfTalk.hit) text = selfTalk.text;
  // sentences about attaching the invisible marks are never for the customer
  const markTalk = dropMarkTalk(text);
  if (markTalk.hit) text = markTalk.text;
  const aside = stripMetaAsides(text);
  if (aside.hit) text = aside.text;
  if (PLAN_AS_REPLY.test(text.trim()) || readsAsNarration(text)) return { text: "", hit: true };
  const stutter = dropStutteredGreeting(text);
  if (stutter.hit) text = stutter.text;
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
  const repeat = collapseRepeats(lines.slice(index).join("\n").trim());
  const kept = repeat.text;
  const stripped = index > 0 || cut.hit || selfTalk.hit || markTalk.hit || aside.hit || stutter.hit || finalPass.hit || repeat.hit || trailed !== raw;
  return { text: kept, hit: stripped && kept !== raw.trim() };
}


/** Plain text is all the bubble can render, so markdown is flattened, not parsed. */
function flatten(text: string): string {
  return text
    .replace(/<\s*\/?br\s*\/?\s*>/gi, "\n") // </br> sent as literal text renders literally
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

/* A model that panics about the marks stamps them on every line — [[BOOK]] plus all six
   SERVICE ids in a row. The widget keeps the LAST mark it sees, so the flood can pick a
   service the customer never mentioned. First mark of each kind wins; later copies are
   dropped. */
function dedupeMarks(text: string): { text: string; hit: boolean } {
  let hit = false;
  const seen = new Set<string>();
  const out = text
    .replace(MARKS, (mark) => {
      const kind = /^\[\[BOOK\]\]$/i.test(mark) ? "BOOK" : "SERVICE";
      if (seen.has(kind)) {
        hit = true;
        return "";
      }
      seen.add(kind);
      return mark;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return { text: out.trim(), hit };
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

  const marks = dedupeMarks(scrubbed.text);
  if (marks.hit) violations.push("duplicate marks dropped");

  // a deleted price leaves a hole that needs the standard cost sentence; a reply that
  // was nothing but narration leaves nothing to answer with, and the caller says so
  const cleaned = marks.text || (scrubbed.hit ? SAFE_COST_LINE : "");
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
