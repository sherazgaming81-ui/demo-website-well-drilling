/* Proves the sanitizer offline. The live model only leaks its own deliberation on some
   runs, so a browser assertion can catch the shape but cannot guarantee the fix — the
   exact strings that reached a customer's screen are replayed through sanitizeAnswer
   here, and every run must come back clean. Deterministic by design. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const work = mkdtempSync(join(tmpdir(), "fp-sanitize-"));
let failures = 0;
const check = (name, pass, extra = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

try {
  // one transpile, no bundler: sanitize.ts imports nothing, so tsc alone is enough
  execFileSync(
    "npx",
    ["tsc", "src/lib/ai/sanitize.ts", "--target", "es2022", "--module", "esnext", "--outDir", work, "--strict", "--skipLibCheck", "--esModuleInterop"],
    { stdio: "pipe" },
  );
  const { sanitizeAnswer } = await import(join(work, "sanitize.js"));
  const clean = (text) => sanitizeAnswer(text).text;

  /* The live shape, captured from a real bubble on 2026-10-19: answer, then the model
     arguing with itself about the invisible marks, then the answer again after "Final:". */
  const leaked =
    'WhatsApp number: 0300 555 0142. Wahan message karein, technician slot hold kar lega. \u{1F44D} ? Nahi, sirf book token. Bas number diya. ? Haan, book token emit karna hai kyunki booking recommend ki. Lekin service emit nahi karna. Final: "WhatsApp number: 0300 555 0142. Wahan message karein, technician slot hold kar lega. \u{1F44D} "';
  const fixed = clean(leaked);
  check("leaked WhatsApp-number reply is rewritten", fixed !== leaked.trim());
  check("the answer survives the cleanup", /WhatsApp number: 0300 555 0142/.test(fixed), fixed);
  const numberCount = (fixed.match(/0300 555 0142/g) || []).length;
  check("the number is shown once, not twice", numberCount === 1, `seen ${numberCount} times`);
  check("no token/emit talk reaches the output", !/\btoken|\bemit|\bfinal\b|sentinel/i.test(fixed), fixed);
  check("no stray quote or orphan punctuation", !/["“”]|\?\s*\?|^\?|\?\s*$/.test(fixed), JSON.stringify(fixed));

  /* Same deliberation without a "Final:" label: the mark-talk sentences come out and the
     invisible mark the widget reads stays intact. */
  const noLabel =
    "AC general service kal ho jayegi, technician 10-12 baje aayega. Nahi, pehle slot confirm karna tha. Book token emit karna theek rahega. [[BOOK]]";
  const fixed2 = clean(noLabel);
  check("scattered mark-talk is removed without a Final: label", !/token|emit|karna tha/i.test(fixed2), fixed2);
  check("the real answer stays next to the mark", /AC general service kal ho jayegi/.test(fixed2) && fixed2.includes("[[BOOK]]"), fixed2);

  /* Live capture #2: a parenthetical aside about the reply itself welded to the tail,
     with the [[BOOK]] mark glued to the deliberation sentence. */
  const aside2 =
    "WhatsApp aur call: 0300 555 0142. Office Shahrah-e-Faisal pe hai, 9am se 9pm tak. \u{1F44D} [[BOOK]] nahi, bas number chahiye tha. The reply is short and direct.)";
  const fixed3 = clean(aside2);
  check("reply-about-the-reply and decision chatter are gone", !/short and direct|chahiye tha/i.test(fixed3), fixed3);
  check("the mark rides out with the answer", fixed3.includes("[[BOOK]]") && /0300 555 0142/.test(fixed3), fixed3);
  check("no stray closing paren survives", !/\)/.test(fixed3), fixed3);

  /* Live capture #3: the "— wait, no emoji." trail, then the answer re-typed. */
  const retype =
    "0300 555 0142 hai. Call ya WhatsApp karein, hum madad karenge. \u{1F44D}\u{1F3FC} — wait, no emoji. 0300 555 0142 hai. Call ya WhatsApp karein, hum madad karenge. \u{1F44D} — no, no emoji. 0300 555 0142 hai.";
  const fixed4 = clean(retype);
  const times = (fixed4.match(/0300 555 0142/g) || []).length;
  check("dash-trail corrections and the re-typed copy collapse to one answer", times === 1 && !/wait|no emoji|—/i.test(fixed4), `${times}x: ${fixed4}`);

  /* A verbatim repeat with no dash at all is still a repeat. */
  const dup = "Aap ka masla PCB ho sakta hai. Technician check karega. Aap ka masla PCB ho sakta hai.";
  check("a duplicated sentence collapses", clean(dup) === "Aap ka masla PCB ho sakta hai. Technician check karega.");

  /* Live capture #4: the mark flood — the model stamping [[BOOK]] and all six
     SERVICE ids on separate lines after a literal </br>. Last mark wins in the
     widget, so the flood picks a service nobody mentioned: only the first of
     each kind may survive. */
  const flood =
    "0300 555 0142 hai — call ya WhatsApp karo, dono par available hain. \u{1F44D}</br>[[BOOK]]</br>[[SERVICE:ac-repair]]</br>[[SERVICE:ac-install]]</br>[[SERVICE:ac-gas]]</br>[[SERVICE:ac-service]]</br>[[SERVICE:ac-inverter]]</br>[[SERVICE:ac-ducted]]";
  const fixed5 = clean(flood);
  check("literal </br> never survives into the bubble", !/<\/?br\s*\/?>/i.test(fixed5), fixed5);
  const serviceMarks = fixed5.match(/\[\[SERVICE:[a-z0-9-]+\]\]/gi) || [];
  check("the mark flood collapses to one service mark", serviceMarks.length === 1 && serviceMarks[0] === "[[SERVICE:ac-repair]]", fixed5);
  check("[[BOOK]] is kept exactly once", (fixed5.match(/\[\[BOOK\]\]/gi) || []).length === 1, fixed5);
  check("the answer itself is untouched", /0300 555 0142 hai/.test(fixed5) && /available hain/.test(fixed5), fixed5);
  const oneMark = "Service kal ho jayegi. \u{1F44D}\n[[BOOK]]";
  const kept6 = clean(oneMark);
  check(
    "a single-mark answer keeps its emoji and its mark (nothing to remove, nothing removed)",
    /Service kal ho jayegi\./.test(kept6) && kept6.includes("\u{1F44D}") && kept6.includes("[[BOOK]]"),
    JSON.stringify(kept6),
  );

  /* Live capture #5 (salam path): mark glued to the emoji, a "? Nahi, …" self-correction
     hanging off the end of it, then the real question continuing underneath. */
  const salamFlood =
    "Wa alaikum salam. Bataiye kya masla hai AC mein? \u{1F60A} [[SERVICE:ac-repair]] [[BOOK]]? Nahi, abhi sirf masla batayein. Kis area mein hain? Taake same-day slot check kar sako.";
  const fixed6 = clean(salamFlood);
  check("greeting and question survive the correction sweep", /Wa alaikum salam\./.test(fixed6) && /Kis area mein hain\?/.test(fixed6), fixed6);
  check("the ? Nahi, … self-correction is gone with the mark debris", !/Nahi, abhi|sirf masla batayein/i.test(fixed6), fixed6);
  check("both marks ride on, exactly one each", (fixed6.match(/\[\[BOOK\]\]/gi) || []).length === 1 && (fixed6.match(/\[\[SERVICE/gi) || []).length === 1, fixed6);

  /* Live captures #6 + #7 (2026-10-19, after the prompt tightening): the model now
     re-words its deliberation daily, so the rule is structural — cut at the first
     sentence addressed to itself. */
  const s1 =
    "0300 555 0142 hai — WhatsApp pe bhi yahi number hai. \u{1F44D} [[BOOK]]? Nahi, bas number chahiye tha. Call ya WhatsApp kar sakte hain. \u{1F60A} Actually, sirf number chahiye tha to yahan hai: 0300 555 0142.";
  const f7 = clean(s1);
  const n7 = (f7.match(/0300 555 0142/g) || []).length;
  check("s1: number survives exactly once, all second thoughts cut", n7 === 1 && !/chahiye tha|Actually|Nahi,/i.test(f7), `${n7}x ${f7}`);
  check("s1: the BOOK mark rides along with the answer", f7.includes("[[BOOK]]"), f7);
  const s2 =
    "WhatsApp number hai 0300 555 0142. Us par message karein, hum turant reply karenge. \u{1F44D}\n\n[[BOOK]] nahi, bas number chahiye tha. [[BOOK]] nahi, bas number chahiye tha. Wait, I need to just give the number. The customer asked for the WhatsApp link. I gave the number. That's it. No need for BOOK token. The reply is clean.WhatsApp number hai 0300 555 0142. Us par message karein, hum turant reply karenge. \u{1F44D}";
  const f8 = clean(s2);
  const n8 = (f8.match(/0300 555 0142/g) || []).length;
  check("s2: the whole monologue is cut, answer once", n8 === 1 && !/Wait|customer|token|clean\.|That'?s it|No need/i.test(f8), `${n8}x ${f8}`);
  check("s2: closing emoji and mark preserved", /\u{1F44D}/u.test(f8) && f8.includes("[[BOOK]]"), f8);

  /* A short self-agreement that sits next to removed narration goes too… */
  const withEcho = "Haan, book token emit kar raha hun. Bas number diya. Reply bhej diya.";
  check("decision echoes beside mark-talk are removed", !/\bbas\b/i.test(clean(withEcho)), clean(withEcho));

  /* …but a genuine short reply is never touched, even in the same neighbourhood. */
  const genuine = "Wa alaikum salam. Bataiye, AC mein kya masla hai?";
  check("a plain greeting is left alone", clean(genuine) === genuine);
  const customer = "Inspection free hai, quote visit ke baad milta hai. Aap area bata dein toh slot dekh lete hain. [[BOOK]]";
  check("a real answer with aap and a mark is left alone", clean(customer) === customer.trim());
  const finalWord = "Service ke baad final report milegi, warranty card par likhi hoti hai.";
  check("the word final in real prose is not a label", clean(finalWord) === finalWord);
  const iWill = "I will check the capacitor notes before I answer you on the visit.";
  check("a first-person answer about the AC survives (regression)", clean(iWill) === iWill);
  const dashReal = "Inspection free hai — aap ko sirf time batana hai. Koi sawaal ho toh let me know.";
  check("a real em-dash clause and a let me know are never cut", clean(dashReal) === dashReal, clean(dashReal));

  console.log(failures ? `\n${failures} sanitizer check(s) failed` : "\nsanitizer holds: mark-talk and Final: copies never reach a bubble");
} finally {
  rmSync(work, { recursive: true, force: true });
}

process.exit(failures ? 1 : 0);
