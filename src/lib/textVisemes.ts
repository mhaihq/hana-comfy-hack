// Lip sync from the words: ElevenLabs sends each spoken character with its start time and length.
// English spelling rules turn the characters into mouth shapes (same names as lib/lipsync):
//   X rest · A closed (M B P) · B teeth (S T K EE) · C open (EH) · D wide (AH) · E round (OH)
//   F pucker (OO W) · G F/V · H L/TH
// Short shapes are merged so every mouth holds at least a few frames, and each shape shows a
// frame early: mouths that lead the sound slightly read as in sync.

import type { Viseme } from "./lipsync";

export type VisemeKey = { t: number; v: Viseme }; // t = ms from the start of the chunk

const MIN_MS = 50;
const LEAD_MS = 17;

// two-letter spellings first, then single letters
const DIGRAPHS: Record<string, Viseme> = {
  th: "H", sh: "B", ch: "B", ph: "G", wh: "F", qu: "F", oo: "F", ou: "E", ow: "E", ee: "B", ea: "B", ai: "C",
  ay: "C", ey: "C", oa: "E", oi: "E", oy: "E", aw: "D", au: "D", ck: "B", ng: "B",
};
const LETTERS: Record<string, Viseme> = {
  m: "A", b: "A", p: "A",
  f: "G", v: "G",
  l: "H",
  w: "F", u: "C", o: "E", r: "E",
  a: "D", e: "C", i: "C", y: "C", h: "C",
  s: "B", z: "B", t: "B", d: "B", n: "B", k: "B", g: "B", c: "B", j: "B", x: "B", q: "B",
};

export function charsToVisemes(chars: string[], startMs: number[], durMs: number[]): VisemeKey[] {
  const keys: { t: number; d: number; v: Viseme }[] = [];
  let inTag = false; // voice direction tags like [excited] are not spoken
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i].toLowerCase();
    if (c === "[") inTag = true;
    if (inTag) {
      if (c === "]") inTag = false;
      continue;
    }
    const pair = c + (chars[i + 1] ?? "").toLowerCase();
    let v: Viseme;
    const t = startMs[i];
    let d = durMs[i];
    if (DIGRAPHS[pair]) {
      v = DIGRAPHS[pair];
      d += durMs[i + 1] ?? 0;
      i++;
    } else if (LETTERS[c]) v = LETTERS[c];
    else if (/[.!?,;:]/.test(c)) v = "X"; // a pause
    else if (c === " ") {
      if (d < 80) continue; // words run together: no closure
      v = d < 250 ? "A" : "X"; // a beat between words closes the lips; a real pause rests
    }
    else continue; // apostrophes, digits, symbols: keep the previous mouth
    keys.push({ t, d, v });
  }
  // merge: same shape back to back, and anything shorter than MIN_MS joins its neighbour
  const out: { t: number; d: number; v: Viseme }[] = [];
  for (const k of keys) {
    const last = out[out.length - 1];
    if (last && (last.v === k.v || k.d < MIN_MS * 0.6)) last.d = k.t + k.d - last.t;
    else if (last && last.d < MIN_MS && k.v !== "A") {
      last.v = k.v; // a too-short shape gives way to the next one (closures excepted)
      last.d = k.t + k.d - last.t;
    } else out.push({ ...k });
  }
  return out.map((k) => ({ t: Math.max(0, k.t - LEAD_MS), v: k.v }));
}
