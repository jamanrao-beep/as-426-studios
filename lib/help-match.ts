import type { Entry } from "./help-kb";

const STOP = new Set("a an the is are am to of in on for and or my me i you your it do does can how what why where when which this that with at be as".split(" "));
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'@ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function stem(w: string) {
  return w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w;
}

const tokenSet = (s: string) => new Set(norm(s).split(" ").filter((w) => w && !STOP.has(w)).map(stem));

export type Match = { entry: Entry; score: number };

// Scores every entry: whole phrases found in the question count a lot, single shared words count a little.
export function ask(KB: Entry[], question: string): Match[] {
  const text = norm(question);
  if (text.length < 2) return [];
  const words = tokenSet(question);
  const out: Match[] = [];
  for (const entry of KB) {
    let score = 0;
    for (const k of entry.keys) {
      const nk = norm(k);
      if (nk.includes(" ")) {
        // The whole phrase, or every word of it somewhere in the question ("add a dish" finds "add dish").
        const parts = [...tokenSet(nk)];
        if (text.includes(nk)) score += 3 + nk.split(" ").length;
        else if (parts.length > 1 && parts.every((w) => words.has(w))) score += 2 + parts.length;
      } else if (words.has(stem(nk)) || text.includes(` ${nk} `) || text.startsWith(nk + " ") || text.endsWith(" " + nk) || text === nk) {
        score += 2;
      }
    }
    for (const w of tokenSet(entry.q)) if (words.has(w)) score += 0.5;
    if (score > 0) out.push({ entry, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function suggestions(KB: Entry[], who: "manager" | "waiter" | "guest" | "anyone", signedIn: boolean): Entry[] {
  return KB.filter((e) => e.suggest && (!e.who || e.who === "anyone" || e.who === who)).filter((e) => signedIn || e.id !== "addWaiter").slice(0, 8);
}

export const GREETING_RE = /^(hi|hello|hey|hii+|good (morning|evening|afternoon)|namaste|yo|sup)\b/;
export const THANKS_RE = /\b(thanks|thank you|thx|ty|great|awesome|cool|nice)\b/;
