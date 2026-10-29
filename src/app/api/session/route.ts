import { NextResponse } from "next/server";

// Returns a short-lived signed URL so the browser can talk to the private ElevenLabs agent
// without ever seeing the API key. (WebSocket transport: it reports speech timing in sync with
// playback, which the lip sync uses.)
export async function GET() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!agentId || !key) return NextResponse.json({ error: "Higgsy isn't set up on this server" }, { status: 404 });

  const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`, {
    headers: { "xi-api-key": key },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "Could not start a call" }, { status: 502 });
  return NextResponse.json({ signedUrl: (await r.json()).signed_url as string });
}
