import { NextResponse } from "next/server";
import { comfyConfigured, generateImage } from "@/lib/comfy";

export const maxDuration = 120;

// Protect the owner's Comfy credits: a global cap per hour, and short prompts only.
const MAX_PER_HOUR = Number(process.env.DEMO_MAX_PER_HOUR ?? 20);
const log: number[] = [];

export async function POST(req: Request) {
  if (!comfyConfigured()) return NextResponse.json({ error: "Demos aren't set up on this server" }, { status: 501 });
  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
  const clean = String(prompt ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (clean.length < 3) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

  const now = Date.now();
  while (log.length && now - log[0] > 3_600_000) log.shift();
  if (log.length >= MAX_PER_HOUR) return NextResponse.json({ error: "Demo limit reached for now" }, { status: 429 });
  log.push(now);

  try {
    return NextResponse.json({ image: await generateImage(clean), prompt: clean });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 502 });
  }
}
