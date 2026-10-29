// Builds data/index.json: searchable passages from Higgsfield's own public pages plus knowledge/*.md.
// Higgsy's lookup tool searches this index, so every answer can name its source.
//
// Polite by design: identifies itself, honours robots.txt, English pages only, 4 requests at a time with a
// pause, a time budget, and a page cap per section. If the network fails it still writes the knowledge/ notes.
// The crawled text is NOT committed (data/index.json is gitignored); it's rebuilt at `npm run build`.
//
// Usage: node scripts/build-index.mjs        (INDEX_BUDGET_SEC=300, INDEX_SKIP_CRAWL=1 to skip the crawl)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ORIGIN = "https://higgsfield.ai";
const UA = "HiggsyKnowledgeBuilder/1.0 (open-source hackathon project; +https://github.com/mhaihq/hana-comfy-hack)";
const BUDGET_MS = Number(process.env.INDEX_BUDGET_SEC ?? 300) * 1000;
const started = Date.now();
const today = new Date().toISOString().slice(0, 10);

// section sitemap -> max pages (newest first by lastmod)
const SECTIONS = [
  { name: "help-center", sitemap: "/enterprise-help-center/sitemap.xml", cap: 40 },
  { name: "marketing", sitemap: "/sitemap-marketing.xml", cap: 260 },
  { name: "apps", sitemap: "/apps/sitemap.xml", cap: 100 },
  { name: "creator-hub", sitemap: "/creator-hub/sitemap.xml", cap: 110 },
  { name: "blog", sitemap: "/blog/sitemap.xml", cap: 150 },
];
const OTHER_LANGS = /^\/(es|ko|de|ja)(\/|$)/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.text();
      if (r.status === 404 || r.status === 403) return null;
    } catch {}
    await sleep(500);
  }
  return null;
}

function disallowRules(robots) {
  const rules = [];
  let inStar = false;
  for (const raw of robots.split("\n")) {
    const line = raw.trim();
    if (/^user-agent:/i.test(line)) inStar = /user-agent:\s*\*/i.test(line);
    else if (inStar && /^disallow:/i.test(line)) {
      const p = line.slice(9).trim();
      if (p) rules.push(new RegExp("^" + p.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$|\$$/, "$")));
    }
  }
  return rules;
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });

function extract(html) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim()).replace(/\s*[|–—-]\s*Higgsfield.*$/i, "");
  const i = html.search(/<main[\s>]/i);
  let body = i >= 0 ? html.slice(i, html.search(/<\/main>/i) > i ? html.search(/<\/main>/i) : undefined) : html;
  body = body
    .replace(/<(script|style|noscript|svg|nav|footer|form|button|select|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|ul|ol|header|figure|figcaption|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines = decode(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return { title, lines };
}

async function crawl(rules) {
  const pages = [];
  const urls = [];
  for (const s of SECTIONS) {
    const xml = await get(ORIGIN + s.sitemap);
    if (!xml) { console.log(`  ${s.name}: sitemap unavailable`); continue; }
    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({ loc: m[1].match(/<loc>([^<]+)<\/loc>/)?.[1], mod: m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? "" }));
    const keep = entries
      .filter((e) => e.loc?.startsWith(ORIGIN))
      .filter((e) => { const p = new URL(e.loc).pathname; return !OTHER_LANGS.test(p) && !rules.some((r) => r.test(p)); })
      .sort((a, b) => b.mod.localeCompare(a.mod))
      .slice(0, s.cap);
    console.log(`  ${s.name}: ${keep.length} of ${entries.length} pages`);
    keep.forEach((e) => urls.push({ url: e.loc, section: s.name }));
  }
  const seen = new Set();
  const queue = urls.filter((u) => !seen.has(u.url) && seen.add(u.url));
  let done = 0;
  const worker = async () => {
    while (queue.length && Date.now() - started < BUDGET_MS) {
      const u = queue.shift();
      const html = await get(u.url);
      if (html) {
        const { title, lines } = extract(html);
        if (lines.join(" ").length > 300) pages.push({ ...u, title: title || new URL(u.url).pathname, lines });
      }
      if (++done % 50 === 0) console.log(`  fetched ${done}/${urls.length}`);
      await sleep(200);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (queue.length) console.log(`  time budget reached; skipped ${queue.length} pages`);
  return pages;
}

function chunk(title, lines, max = 900) {
  const out = [];
  let cur = "";
  for (const l of lines) {
    if (cur && cur.length + l.length + 1 > max) { out.push(cur); cur = ""; }
    cur += (cur ? "\n" : "") + l;
    while (cur.length > max * 1.6) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur.length > 40) out.push(cur);
  return out.map((text) => ({ title, text }));
}

const chunks = [];

// core notes (committed): pricing, models, links. Marked core so they rank first.
for (const f of readdirSync("knowledge").filter((f) => f.endsWith(".md")).sort()) {
  const md = readFileSync(`knowledge/${f}`, "utf8");
  const url = md.match(/^Source:\s*(\S+)/m)?.[1] ?? ORIGIN;
  const title = md.match(/^#\s+(.+)$/m)?.[1] ?? f;
  const dated = md.match(/(?:read on|verified|snapshot)[^.\n]*?(\d{4}-\d{2}-\d{2}|October 2026)/i)?.[1] ?? today;
  for (const c of chunk(title, md.split("\n").map((l) => l.trim()).filter(Boolean), 700)) chunks.push({ ...c, url, fetched: dated, core: true });
}
console.log(`core notes: ${chunks.length} passages`);

let pageCount = 0;
if (!process.env.INDEX_SKIP_CRAWL) {
  console.log("crawling higgsfield.ai (robots.txt respected)…");
  const robots = await get(ORIGIN + "/robots.txt");
  const rules = robots ? disallowRules(robots) : [];
  const pages = await crawl(rules);
  // lines repeated across many pages are menus and footers: drop them
  const freq = new Map();
  for (const p of pages) for (const l of new Set(p.lines)) freq.set(l, (freq.get(l) ?? 0) + 1);
  const boiler = Math.max(8, Math.floor(pages.length * 0.06));
  for (const p of pages) {
    const lines = p.lines.filter((l) => (freq.get(l) ?? 0) < boiler);
    if (lines.join(" ").length < 200) continue;
    pageCount++;
    for (const c of chunk(p.title, lines)) chunks.push({ ...c, url: p.url, fetched: today, section: p.section });
  }
}

mkdirSync("data", { recursive: true });
writeFileSync("data/index.json", JSON.stringify({ built: today, pages: pageCount, chunks }));
console.log(`wrote data/index.json: ${chunks.length} passages from ${pageCount} pages + core notes in ${Math.round((Date.now() - started) / 1000)}s`);
