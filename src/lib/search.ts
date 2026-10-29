// BM25 search over data/index.json (built by scripts/build-index.mjs): passages from Higgsfield's own
// pages and our knowledge/ notes. No embeddings or external service; results always carry their source URL.
import { readFileSync } from "node:fs";
import path from "node:path";

export type Passage = { title: string; text: string; url: string; fetched: string; core?: boolean };
type Index = { built: string; passages: Passage[]; tf: Map<string, number>[]; len: number[]; df: Map<string, number>; avg: number };

const STOP = new Set(("a an and are as at be but by can do does for from has have how i if in into is it its me my of on or so that the their then there these they this to was we what when where which who will with you your about get got just like").split(" "));
const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t));

let index: Index | null | undefined;

function load(): Index | null {
  if (index !== undefined) return index;
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "data", "index.json"), "utf8")) as { built: string; chunks: Passage[] };
    const tf: Map<string, number>[] = [];
    const len: number[] = [];
    const df = new Map<string, number>();
    for (const p of raw.chunks) {
      const t = tokens(`${p.title} ${p.title} ${p.text}`); // title counts double
      const m = new Map<string, number>();
      for (const w of t) m.set(w, (m.get(w) ?? 0) + 1);
      for (const w of m.keys()) df.set(w, (df.get(w) ?? 0) + 1);
      tf.push(m);
      len.push(t.length);
    }
    index = { built: raw.built, passages: raw.chunks, tf, len, df, avg: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length) };
  } catch {
    index = null;
  }
  return index;
}

export function search(query: string, k = 4): { built: string; results: Passage[] } | null {
  const ix = load();
  if (!ix) return null;
  const q = [...new Set(tokens(query))];
  if (!q.length) return { built: ix.built, results: [] };
  const N = ix.passages.length;
  const scored: { i: number; s: number }[] = [];
  for (let i = 0; i < N; i++) {
    let s = 0;
    let hit = 0;
    for (const w of q) {
      const f = ix.tf[i].get(w);
      if (!f) continue;
      hit++;
      const idf = Math.log(1 + (N - (ix.df.get(w) ?? 0) + 0.5) / ((ix.df.get(w) ?? 0) + 0.5));
      s += (idf * f * 2.4) / (f + 1.4 * (0.25 + 0.75 * (ix.len[i] / ix.avg)));
    }
    if (hit === 0) continue;
    s *= 0.6 + 0.4 * (hit / q.length); // reward passages that cover more of the question
    if (ix.passages[i].core) s *= 1.3; // our dated notes outrank marketing copy
    scored.push({ i, s });
  }
  scored.sort((a, b) => b.s - a.s);
  const perUrl = new Map<string, number>();
  const results: Passage[] = [];
  const floor = (scored[0]?.s ?? 0) * 0.45;
  for (const { i, s } of scored) {
    if (results.length >= k || s < floor) break;
    const p = ix.passages[i];
    if ((perUrl.get(p.url) ?? 0) >= 2) continue;
    perUrl.set(p.url, (perUrl.get(p.url) ?? 0) + 1);
    results.push(p);
  }
  return { built: ix.built, results };
}
