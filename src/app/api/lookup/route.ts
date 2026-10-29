import { NextResponse } from "next/server";
import { search } from "@/lib/search";

// Higgsy's lookup tool (an ElevenLabs server tool) calls this. Read-only, no keys, only our own index.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 300).trim();
  if (q.length < 2) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  const found = search(q);
  if (!found) return NextResponse.json({ results: [], note: "The knowledge index isn't available on this server." });
  return NextResponse.json({
    query: q,
    index_built: found.built,
    results: found.results.map((p) => ({ title: p.title, source: p.url, as_of: p.fetched, text: p.text })),
    note: found.results.length
      ? "Answer only from these passages. Say where it comes from. If they don't answer the question, say you don't know."
      : "Nothing relevant was found in Higgsfield's pages. Say you don't know and point to the official pages.",
  });
}
