/**
 * Sanitiser checks — `node scripts/sanitize-check.mjs`
 *
 * The gateway sometimes answers a customer by arguing with itself: a full reply, then
 * "Nahi, bas link chahiye tha", then a rewrite under a "Final:" label. That prose is not
 * a style problem, it is the model's draft leaking into a paying customer's chat bubble,
 * and no live browser test can be trusted to reproduce it on demand — the model decides
 * whether to leak today. So the strip is tested against the strings it actually produced,
 * plus the good answers that must come out untouched.
 *
 * src/lib/ai/sanitize.ts is transpiled in place with the repo's own typescript, so this
 * runs the shipped source rather than a copy of its rules, and needs no build and no key.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "src/lib/ai/sanitize.ts"), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});

const dir = await mkdtemp(path.join(os.tmpdir(), "sanitize-check-"));
const file = path.join(dir, "sanitize.mjs");
await writeFile(file, outputText, "utf8");
const { sanitizeAnswer } = await import(pathToFileURL(file).href);

let failures = 0;
const check = (name, pass, extra = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const run = (raw) => {
  const result = sanitizeAnswer(raw);
  return { ...result, shown: result.text };
};

/* ── what the model really sent, word for word ───────────────────────────── */

// Live from the gateway, 3/3 runs, for "mujhe whatsapp link do".
const argued =
  "WhatsApp pe baat karne ke liye ye number use karein: 0300 555 0142. Aap is par message bhej sakte hain, hum turant reply denge. \u{1F60A} [[BOOK]]? Nahi, bas link chahiye tha. Koi baat nahi, number hi kaafi hai.";
const arguedClean = run(argued);
check("debate after the answer is gone", !/Nahi|kaafi hai|bas link/i.test(arguedClean.shown), arguedClean.shown);
check("the answer itself survives", arguedClean.shown.includes("0300 555 0142") && arguedClean.shown.includes("turant reply denge"), arguedClean.shown);
check("[[BOOK]] is kept so the CTA still lights up", arguedClean.shown.includes("[[BOOK]]"), arguedClean.shown);
check("no stray question mark hung on the tag", !/\?\s*$/.test(arguedClean.shown.split("\n")[0]), JSON.stringify(arguedClean.shown));
check("sanitiser reports it changed the reply", arguedClean.changed === true && arguedClean.violations.length > 0, arguedClean.violations.join(", "));

// Screenshot from the live site: the same answer written twice, the second one quoted.
const drafted =
  'WhatsApp number: 0300 555 0142. Wahan message karein, technician slot hold kar lega. \u{1F44D} ? Nahi, sirf book token. Bas number diya. ? Haan, book token emit karna hai kyunki booking recommend ki. Lekin service emit nahi karna. Final: "WhatsApp number: 0300 555 0142. Wahan message karein, technician slot hold kar lega. \u{1F44D}"';
const draftedClean = run(drafted);
check("the discarded draft is not shown", !/Final:|book token|emit|Lekin service/i.test(draftedClean.shown), draftedClean.shown);
check("the reply the model actually wanted to send is kept", draftedClean.shown.startsWith("WhatsApp number: 0300 555 0142.") && draftedClean.shown.includes("technician slot hold kar lega"), draftedClean.shown);
check("the answer is not written twice", (draftedClean.shown.match(/0300 555 0142/g) ?? []).length === 1, draftedClean.shown);
check("no quotation marks left around the sentence", !/^["“”]|["“”]$/.test(draftedClean.shown.trim()), JSON.stringify(draftedClean.shown));

// Two more, both measured live against the shipped brief on the same question — the
// model arguing about a page tag in the middle of a reply, once as an inline margin
// note and once with the answer repeated after it.
const margin =
  "WhatsApp link: https://wa.me/923005550142 \u{1F44D}\n\n[[BOOK]]? No, just the link. Hmm, actually the reply told them to message? No, it just gave the link. No tag needed. But wait, the instruction says [[BOOK]] goes if the reply tells customer to book, call or message. Here I just gave the link, no action requested. So no tag. Correct.WhatsApp link: https://wa.me/923005550142 \u{1F44D}";
const marginClean = run(margin);
check("a tag argument in the middle of a reply is gone", /No, just the link|tag needed|instruction says|So no tag|Correct\./i.test(marginClean.shown) === false, marginClean.shown);
check("…and the link is still there, once", (marginClean.shown.match(/wa\.me\/923005550142/g) ?? []).length === 1, marginClean.shown);

const note =
  "Yahan WhatsApp link hai: https://wa.me/923005550142\n\n[[BOOK]]  <-- this line is not part of the reply; ignore it. Actually, the reply is just the link and the greeting. The tag should be on its own line after the answer. Let me correct.\n\nWhatsApp link: https://wa.me/923005550142\n\n[[BOOK]]";
const noteClean = run(note);
check("a margin note and its rewrite are both removed", /ignore it|not part of|Let me correct|should be on its own line/i.test(noteClean.shown) === false, noteClean.shown);
check("…and the answer the customer asked for survives", /https:\/\/wa\.me\/923005550142/.test(noteClean.shown) && (noteClean.shown.match(/wa\.me/g) ?? []).length === 1, noteClean.shown);
check("…with the page tag kept for the CTA", noteClean.shown.includes("[[BOOK]]"), JSON.stringify(noteClean.shown));

// Live, temperature 0.7, same question: the model went degenerate and printed the answer
// four times. One bubble, one answer — the customer gets the sentence once.
const looped =
  "Here\u2019s the WhatsApp link: https://wa.me/923005550142 \u{1F44D}\n\n[[BOOK]]WhatsApp link ye hai: https://wa.me/923005550142 \u{1F44D}\n\n[[BOOK]]WhatsApp link ye hai: https://wa.me/923005550142 \u{1F44D}\n\n[[BOOK]]WhatsApp link ye hai: https://wa.me/923005550142 \u{1F44D}\n\n[[BOOK]]";
const loopedClean = run(looped);
check("a reply the model looped four times is sent once", (loopedClean.shown.match(/923005550142/g) ?? []).length === 1, loopedClean.shown);
check("…and the loop leaves no gap in the answer", /whatsapp link/i.test(loopedClean.shown) && loopedClean.shown.includes("https://wa.me/923005550142"), loopedClean.shown);

// A pair of sentences that share almost every word but disagree on "nahi" is not a loop.
const refused = run("Aaj shaam 6 baje team bhej sakte hain. Aaj shaam 6 baje team nahi bhej sakte, barish ki wajah se.");
check("a sentence that contradicts the one before it is kept", refused.shown.includes("nahi bhej sakte"), refused.shown);

// Measured live on the greeting: the model talked itself out of a tag in the middle of a
// salaam. "No, wait …" is the shape; a real answer starting with "No," has to survive it.
const changed = run("Wa alaikum salam. Kaise madad kar sakte hain? AC ki koi problem hai ya naya lena hai? \u{1F60A} No, wait customer just said salaam. No booking instruction, no service named. [[BOOK]]");
check("“No, wait …” about the customer is not sent to the customer", !/No, wait|no service named|just said salaam/i.test(changed.shown), changed.shown);
check("…and the greeting itself is intact", changed.shown.startsWith("Wa alaikum salam.") && changed.shown.includes("[[BOOK]]"), changed.shown);
const honestNo = run("Aaj same-day visit nahi ho payega, kal subah ka pehla slot dekh raha hoon.");
check("an answer that starts with a refusal is not mistaken for a reversal", !honestNo.changed, honestNo.shown);

// The repeat rule on its own: nothing in the middle is a tell, but the answer was
// written twice in one bubble, which is never how this business answers.
const echoed = run("Gas charging kal subah ho jayega, technician gauges le kar aayega.\n\nMain soch raha tha.\n\nGas charging kal subah ho jayega, technician gauges le kar aayega.");
check("an answer written twice collapses to once", (echoed.shown.match(/Gas charging/g) ?? []).length === 1 && echoed.shown.includes("gauges le kar aayega"), echoed.shown);

// A bare tag block after the answer is plumbing, not prose, and must not be edited away.
const tagged = "Coil aur filter jet clean karwane ke baad smell khatam ho jata hai. Aaj slot check karwa lein.\n\n[[BOOK]]  \n[[SERVICE:ac-service]]";
const taggedClean = run(tagged);
// nothing removed, nothing added: the sanitiser may only fold the whitespace
const norm = (value) => value.replace(/\s+/g, " ").trim();
check("a well-behaved tagged reply is left alone", norm(taggedClean.shown) === norm(tagged) && taggedClean.violations.length === 0, taggedClean.shown);

// The old failure that started all of this: the plan as the whole reply.
const planOnly = run("I should: 1. greet in Hinglish 2. keep it short 3. mention the free inspection. No prices.");
check("a reply that is nothing but a plan is refused", planOnly.text.trim().length === 0 || planOnly.changed, JSON.stringify(planOnly));

/* ── good answers, which the strip must never touch ──────────────────────── */

const keep = [
  "Pehle isolator off kar dein, phir humein call karein — burning smell par hum gauges ke bina kaam nahi karte.",
  "Kal subah 9 baje team bhej sakte hain, area DHA Phase 5 hai to rasta bhi clear rahega.",
  "Service ka faasla ye hai ke coil, blower wheel aur filter pressure-wash hote hain, isi se unit thanda chalta hai.",
  "Ji, Sunday sirf emergency call-out hai. Office Monday se Saturday khula rehta hai.",
  "Aap ka number 0300 555 0142 par save kar lein, ya wa.me/923005550142 khol kar seedha message karein.",
  "Breaker trip ho raha hai to AC chhune se pehle main switch off karein — ye licensed technician ka kaam hai.",
];
for (const sample of keep) {
  const result = run(sample);
  check(`untouched: "${sample.slice(0, 42)}…"`, result.shown === sample.trim() && !result.changed, result.shown === sample.trim() ? "" : `got ${JSON.stringify(result.shown)}`);
}

// A sentence that starts like a reversal but carries the answer is not a model's note.
const reversal = run("Coil cleaning ka faasla chhota hai. Par pehle technician ko board dikhna chahiye, warna ghalti hoti hai.");
check("a real 'par…' sentence is not cut", !reversal.changed && reversal.shown.includes("Par pehle technician"), reversal.shown);

/* ── the other two rules the sanitiser exists for ────────────────────────── */

const priced = run("General service Rs 5,000 mein ho jayega, aaj hi aa sakte hain.");
check("a quoted price still gets removed", !/Rs\s?5,?000/i.test(priced.shown) && priced.violations.includes("price figure removed"), priced.shown);
check("…and the cost rule replaces it", /free inspection/i.test(priced.shown), priced.shown);

const greeted = run("Wa alaikum salam! (If you prefer English, let me know.)Wa alaikum salam! Bataein, AC mein kya masla hai?");
check("a doubled greeting still collapses to one", (greeted.shown.match(/[Ww]a alaikum/g) ?? []).length === 1, greeted.shown);

await rm(dir, { recursive: true, force: true });
console.log(failures ? `\n${failures} check(s) failed` : "\nall sanitiser checks passed");
process.exit(failures ? 1 : 0);
